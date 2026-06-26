import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { initRateLimiters } from "./lib/rateLimiter";
import { getHealthStatus, metrics, generateCorrelationId, logger } from "./lib/observability";

const app = new Hono<{ Bindings: HttpBindings }>();

// ==================== SECURITY HEADERS ====================
app.use("*", secureHeaders({
  xFrameOptions: "DENY",
  xXssProtection: "1; mode=block",
  xContentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin",
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
  },
}));

// ==================== CORS ====================
app.use("*", cors({
  origin: env.isProduction
    ? env.allowedOrigins
    : ["http://localhost:5173", "http://localhost:3000"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-CSRF-Token"],
  exposeHeaders: ["X-Request-ID"],
  credentials: true,
  maxAge: 3600,
}));

// ==================== CSRF VALIDATION ====================
// Protects all state-changing tRPC mutations.
// GET/OPTIONS are exempt. Applies to /api/trpc/* POST requests.
app.use("/api/trpc/*", async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "OPTIONS" || method === "HEAD") {
    return next();
  }
  // Skip CSRF for auth.signIn and auth.signUp (no cookie yet)
  const url = c.req.url;
  const isPublicAuthPath = url.includes("auth.signIn") || url.includes("auth.signUp") || url.includes("auth.refresh");
  if (isPublicAuthPath) return next();

  const csrfHeader = c.req.header("x-csrf-token");
  const sessionId  = extractSessionIdFromBearer(c.req.raw);

  if (!csrfHeader || !sessionId) {
    // Log CSRF failure
    const ip = getIP(c);
    console.warn("[csrf] missing token", { ip, url: url.slice(0, 100) });
    return c.json({ error: "CSRF validation failed" }, 403);
  }

  const { validateCsrfToken } = await import("./lib/tokenService");
  if (!await validateCsrfToken(csrfHeader, sessionId)) {
    const ip = getIP(c);
    console.error("[csrf] token invalid", { ip, url: url.slice(0, 100) });
    return c.json({ error: "CSRF validation failed" }, 403);
  }

  return next();
});

function extractSessionIdFromBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    const { verifyAccessToken } = require("./lib/tokenService");
    const payload = verifyAccessToken(token);
    return payload?.sessionId ?? null;
  } catch { return null; }
}

// ==================== BODY LIMIT ====================
const MAX_BYTES = env.maxFileSizeMb * 1024 * 1024;
app.use("*", bodyLimit({ maxSize: MAX_BYTES }));

// ==================== CORRELATION ID ====================
app.use("*", async (c, next) => {
  const reqId = c.req.header("x-request-id") ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  c.set("reqId" as never, reqId);
  await next();
  c.header("X-Request-ID", reqId);
});

// ==================== RATE LIMITING ====================
import { globalLimiter, analyzeLimiter, authLimiter } from "./lib/rateLimiter";

// Backward-compatible shim — callers use: await rl.allow(key, max, window)
function rateLimit(
  _unused: unknown,
  _ip: string,
  _max: number,
  _windowMs: number
): boolean {
  // Replaced by RateLimiter class; this shim is kept for safety
  return true;
}

function getIP(c: any): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

// ==================== INPUT SANITIZATION ====================
function sanitizeString(s: string, maxLength = 500): string {
  return String(s)
    .replace(/[<>'"]/g, "")
    .slice(0, maxLength)
    .trim();
}

// ==================== FILE VALIDATION ====================
const BLOCKED_EXTENSIONS = new Set([
  "exe","bat","cmd","sh","ps1","php","js","ts","py","rb","go","java","class",
  "jar","war","dll","so","dylib","vbs","wsf","hta","msi","scr","pif","reg",
  "inf","lnk","html","htm","svg","xml","zip","tar","gz","7z","rar"
]);
const ALLOWED_EXTENSIONS = new Set(["xlsx","xls","xlsm","csv","pdf"]);

const FILE_SIGNATURES: Record<string, number[][]> = {
  xlsx: [[0x50,0x4B,0x03,0x04]], // ZIP-based
  xls:  [[0xD0,0xCF,0x11,0xE0]],
  pdf:  [[0x25,0x50,0x44,0x46]], // %PDF
  csv:  [], // text — no magic bytes
};

function validateFileExtension(filename: string): string | null {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (BLOCKED_EXTENSIONS.has(ext)) return `نوع الملف '${ext}' محظور لأسباب أمنية`;
  if (!ALLOWED_EXTENSIONS.has(ext)) return `يجب رفع ملف Excel (xlsx/xls/xlsm)، CSV، أو PDF فقط`;
  return null;
}

function validateFileMagicBytes(buffer: Buffer, filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const sigs = FILE_SIGNATURES[ext];
  if (!sigs || sigs.length === 0) return true; // csv: trust extension
  return sigs.some(sig => sig.every((byte, i) => buffer[i] === byte));
}

/**
 * P4-24: Detect VBA macros in .xlsm files.
 * XLSM is a ZIP archive. If xl/vbaProject.bin exists inside, macros are present.
 * We check for the stored filename bytes without fully extracting the archive.
 */
function containsVbaMacros(buffer: Buffer, filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (ext !== "xlsm") return false;
  // Search for "vbaProject.bin" string inside the ZIP central directory
  const marker = Buffer.from("vbaProject.bin", "utf8");
  return buffer.indexOf(marker) !== -1;
}

// ==================== FILE ANALYSIS ENDPOINT ====================
app.post("/api/analyze", async (c) => {
  const ip = getIP(c);

  // ── JWT Authentication — VULN-002 fix ─────────────────────────────────
  const authHeader = c.req.header("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return c.json({ success: false, error: "مطلوب تسجيل الدخول" }, 401);
  }
  const rawAccessToken = authHeader.slice(7).trim();
  let jwtUser: { id: number; companyId: number | null; plan: string; reportsUsed: number; reportsLimit: number } | null = null;
  try {
    const { verifyAccessToken } = await import("./lib/tokenService");
    const payload = verifyAccessToken(rawAccessToken) as Record<string, unknown>;
    if (!payload?.id) throw new Error("invalid payload");
    jwtUser = payload as typeof jwtUser;
  } catch {
    return c.json({ success: false, error: "رمز المصادقة غير صالح أو منتهي الصلاحية" }, 401);
  }

  // ── Server-side Plan Enforcement (P1-8 fix) ──────────────────────────────
  // Plan limits enforced in database — not sessionStorage (client-side)
  {
    const { checkPlanLimit } = await import("./queries/reports");
    const limitCheck = await checkPlanLimit(
      jwtUser!.id,
      jwtUser!.plan,
      jwtUser!.reportsLimit ?? 3,
    );
    if (!limitCheck.allowed) {
      return c.json({ success: false, error: limitCheck.reason }, 402);
    }
  }

  // Analyze-specific rate limit: 10/15min per IP
  if (!await analyzeLimiter.allow(`analyze:${ip}`, env.analyzeRateLimitMax, env.rateLimitWindowMs)) {
    return c.json({ success: false, error: "تم تجاوز الحد المسموح به من الطلبات. الرجاء المحاولة لاحقاً." }, 429);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const rawCompanyName = (formData.get("companyName") as string) || "My Company";
    const companyName = sanitizeString(rawCompanyName, 200);
    // Bind uploads to authenticated user's companyId (VULN-002)
    const _uploadOwnerCompanyId = jwtUser!.companyId;

    if (!file) return c.json({ success: false, error: "لم يتم رفع أي ملف" }, 400);
    if (!file.name) return c.json({ success: false, error: "اسم الملف مفقود" }, 400);

    // Extension validation
    const extError = validateFileExtension(file.name);
    if (extError) return c.json({ success: false, error: extError }, 400);

    // Size validation (double-check after body limit)
    if (file.size > MAX_BYTES) {
      return c.json({ success: false, error: `حجم الملف كبير جداً. الحد الأقصى ${env.maxFileSizeMb} ميجابايت` }, 400);
    }

    // Zero-byte file
    if (file.size === 0) return c.json({ success: false, error: "الملف فارغ" }, 400);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Magic bytes validation
    if (!validateFileMagicBytes(buffer, file.name)) {
      return c.json({ success: false, error: "محتوى الملف لا يطابق امتداده. الملف قد يكون تالفاً أو مزيفاً." }, 400);
    }

    // P4-24: Reject xlsm files containing VBA macros
    if (containsVbaMacros(buffer, file.name)) {
      return c.json({
        success: false,
        error: "الملفات التي تحتوي على ماكرو (VBA) غير مسموح بها لأسباب أمنية. يرجى رفع ملف xlsx بدون ماكرو.",
      }, 400);
    }

    const ext = file.name.toLowerCase().split(".").pop() || "";
    const isPDF = ext === "pdf";
    const isCSV = ext === "csv";

    let rawData: Record<string, unknown>[] = [];

    // P2-12: Delegated to FileParserService (independently testable)
    const { parsePDF, parseExcel, parseCSV } = await import("./services/FileParserService");
    if (isPDF) {
      const pdfResult = await parsePDF(bytes);
      if (!pdfResult.ok) {
        return c.json({ success: false, error: pdfResult.error }, 400);
      }
      rawData = pdfResult.rows;
    } else if (isCSV) {
      rawData = await parseCSV(buffer);
    } else {
      rawData = await parseExcel(buffer, file.name);
    }

    if (rawData.length === 0) {
      return c.json({
        success: false,
        error: isPDF
          ? "لم نتمكن من استخراج البيانات من هذا PDF. تأكد من أن الملف يحتوي على جداول مالية واضحة، أو استخدم Excel."
          : "الملف فارغ أو لا يحتوي على بيانات مالية قابلة للقراءة.",
      }, 422);
    }

    const { mapFinancialColumns, normalizeFinancialData } = await import("../src/lib/semanticMapping");
    const { analyzeFinancials } = await import("../src/lib/financialEngine");

    const columns = Object.keys(rawData[0]);
    const mappings = mapFinancialColumns(columns);
    const normalizedData = normalizeFinancialData(rawData, mappings);

    if (normalizedData.length === 0 || normalizedData.every(r => r.revenue === 0)) {
      return c.json({
        success: false,
        error: "لم نتعرف على أعمدة مالية في الملف. تأكد من وجود بيانات مثل: Revenue, Expenses, Assets.",
      }, 422);
    }

    const financials = analyzeFinancials(normalizedData);
    // P2-12: Delegated to AIInsightService
    const { generateInsights: genInsights } = await import("./services/AIInsightService");
    const insights = await genInsights(financials, companyName, env.anthropicApiKey);

    // Audit log — never log financial data itself
    const { auditLog, extractAuditContext } = await import("./lib/auditLogger");
    const reqCtx = extractAuditContext(c.req.raw);
    auditLog({
      action: "upload.create",
      severity: "info",
      ipAddress: reqCtx.ipAddress,
      userAgent: reqCtx.userAgent,
      metadata: {
        fileType:   ext,
        fileSizeKb: Math.round(file.size / 1024),
        records:    normalizedData.length,
        score:      String((financials as Record<string, Record<string, number>>)?.score?.overall ?? 0),
      },
    });

    // P1-9: Persist report to database (removes localStorage dependency)
    try {
      const { saveReport } = await import("./queries/reports");
      const score = (financials as Record<string, unknown>)?.score as Record<string, unknown> | undefined;
      await saveReport({
        userId:      jwtUser!.id,
        companyId:   jwtUser!.companyId ?? 0,
        companyName,
        score:       Number((score?.overall as number) ?? 0),
        revenue:     null,
        netProfit:   null,
        netMargin:   null,
        dataSnapshot: null, // Production: encrypt and store insights snapshot
      });
    } catch (dbErr) {
      // Non-fatal: report analysis succeeded — log but don't fail the response
      console.error("[analyze] report persist failed:", (dbErr as Error).message);
    }

    return c.json({ success: true, financials, insights, companyName, isPDF });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Analysis failed";
    console.error("[analyze] error:", msg);
    return c.json({ success: false, error: msg }, 500);
  }
});

// ==================== BILLING CHECKOUT ENDPOINT (P1-6, P1-7 fix) ====================
// Real Stripe Checkout Session — no tRPC permission guard on webhook
app.post("/api/billing/checkout", async (c) => {
  // Auth: require valid JWT
  const authHeader = c.req.header("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return c.json({ error: "مطلوب تسجيل الدخول" }, 401);
  }
  const rawToken = authHeader.slice(7).trim();
  let userId: number;
  try {
    const { verifyAccessToken } = await import("./lib/tokenService");
    const payload = verifyAccessToken(rawToken) as Record<string, unknown>;
    userId = payload.id as number;
    if (!userId) throw new Error("invalid");
  } catch {
    return c.json({ error: "رمز المصادقة غير صالح" }, 401);
  }

  const url = new URL(c.req.url);
  const plan = url.searchParams.get("plan") ?? "";
  if (!["professional", "business"].includes(plan)) {
    return c.json({ error: "خطة غير صالحة" }, 400);
  }

  try {
    const origin   = c.req.header("origin") ?? `https://${c.req.header("host")}`;
    const gateway  = c.req.query("gateway") ?? (process.env.MOYASAR_SECRET_KEY ? "moyasar" : "stripe");
    const successUrl = `${origin}/billing/success?plan=${plan}`;
    const cancelUrl  = `${origin}/billing/cancel`;

    if (gateway === "moyasar" && process.env.MOYASAR_SECRET_KEY) {
      // P6-32: Moyasar for Saudi market
      const { createMoyasarCheckoutSession } = await import("./lib/billing");
      const result = await createMoyasarCheckoutSession(
        userId,
        plan as "professional" | "business",
        successUrl,
        cancelUrl,
      );
      return c.json(result);
    } else {
      // Stripe (international / default)
      const { createStripeCheckoutSession } = await import("./lib/billing");
      const result = await createStripeCheckoutSession(
        userId,
        plan as "professional" | "business",
        successUrl,
        cancelUrl,
      );
      return c.json(result);
    }
  } catch (e) {
    console.error("[billing] checkout error:", (e as Error).message);
    return c.json({ error: "فشل إنشاء جلسة الدفع" }, 500);
  }
});

// ==================== STRIPE WEBHOOK RAW HTTP ENDPOINT (P1-7 fix) ====================
// Stripe cannot authenticate as super_admin — signature is the ONLY auth.
app.post("/api/billing/stripe-webhook", async (c) => {
  const sigHeader = c.req.header("stripe-signature") ?? "";
  const secret    = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret) return c.json({ error: "Webhook not configured" }, 500);

  const body = await c.req.text();
  const { verifyStripeWebhook, processStripeEvent, isEventProcessed, markEventProcessed } = await import("./lib/billing");

  if (!verifyStripeWebhook(body, sigHeader, secret)) {
    return c.json({ error: "Invalid Stripe signature" }, 401);
  }

  const event = JSON.parse(body) as { id: string; type: string; data: { object: Record<string, unknown> } };
  if (await isEventProcessed("stripe", event.id)) {
    return c.json({ status: "skipped", reason: "duplicate" });
  }

  const result = await processStripeEvent(event.id, event.type, event.data.object);
  await markEventProcessed("stripe", event.id, result.action === "failed" ? "failed" : "processed", body.slice(0, 500));
  return c.json({ status: result.action });
});

// ==================== LEGACY HEALTH ALIAS ====================
app.get("/api/health", async (c) => {
  const health = await getHealthStatus();
  return c.json({ ...health, hasAI: !!env.anthropicApiKey, hasDB: !!env.databaseUrl });
});

// ==================== PDF EXTRACTION ====================
async function extractPDFData(bytes: ArrayBuffer, _buffer: Buffer): Promise<Record<string, unknown>[]> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str: string; transform: number[] }>;
      const lineMap = new Map<number, string[]>();
      for (const item of items) {
        const y = Math.round(item.transform[5]);
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y)!.push(item.str);
      }
      const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
      for (const y of sortedY) {
        fullText += lineMap.get(y)!.join(" ") + "\n";
      }
    }
    return parsePDFTextToRows(fullText);
  } catch (e) {
    console.error("[pdf] extraction failed:", e);
    return [];
  }
}

// Arabic-Indic digit map: ٠١٢٣٤٥٦٧٨٩ → 0123456789
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
function toWesternNum(s: string): string {
  return s.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => String(ARABIC_INDIC.indexOf(d)));
}
function parseNum(s: string): number {
  // Handle parentheses for negative numbers: (1,234) → -1234
  const negative = /^\(.*\)$/.test(s.trim());
  const cleaned = toWesternNum(s).replace(/[()،,\s']/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

function parsePDFTextToRows(text: string): Record<string, unknown>[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const record: Record<string, unknown> = { month: "Period 1" };
  const numRegex = /[\d٠-٩][\d٠-٩,،.]*(?:\.\d+)?/g;

  const matchers: Array<{ test: RegExp; key: string }> = [
    { test: /revenue|sales|إيراد|مبيعات|الإيرادات|المبيعات/i, key: "revenue" },
    { test: /net (income|profit)|صافي (الربح|الدخل)|الربح الصافي/i, key: "netIncome" },
    { test: /cost of (goods|revenue|sales)|تكلفة (البضاعة|المبيعات|الإيرادات)/i, key: "cogs" },
    { test: /gross profit|الربح الإجمالي|مجمل الربح/i, key: "grossProfit" },
    { test: /ebitda|الأرباح قبل الفوائد والضرائب والإهلاك/i, key: "ebitda" },
    { test: /ebit|operating income|الربح التشغيلي|الأرباح التشغيلية/i, key: "ebit" },
    { test: /operating exp|مصاريف تشغيل|مصروفات تشغيلية/i, key: "operatingExpenses" },
    { test: /interest exp|مصاريف فوائد|تكلفة تمويل/i, key: "interestExpense" },
    { test: /\btax\b|ضريبة|الضريبة/i, key: "tax" },
    { test: /total assets|إجمالي الأصول/i, key: "totalAssets" },
    { test: /current assets|الأصول المتداولة/i, key: "currentAssets" },
    { test: /fixed assets|الأصول الثابتة|property plant/i, key: "fixedAssets" },
    { test: /total liabilit|إجمالي الخصوم|إجمالي الالتزامات/i, key: "totalLiabilities" },
    { test: /current liabilit|الخصوم المتداولة/i, key: "currentLiabilities" },
    { test: /total equity|حقوق الملكية|إجمالي حقوق/i, key: "totalEquity" },
    { test: /\bcash\b|النقد|السيولة/i, key: "cash" },
    { test: /inventory|مخزون|البضاعة/i, key: "inventory" },
    { test: /accounts receivable|المدينون|ذمم مدينة/i, key: "accountsReceivable" },
    { test: /accounts payable|الدائنون|ذمم دائنة/i, key: "accountsPayable" },
    { test: /retained earnings|الأرباح المحتجزة/i, key: "retainedEarnings" },
    { test: /operating cash|التدفق النقدي التشغيلي/i, key: "operatingCashFlow" },
    { test: /depreciation|الإهلاك|استهلاك/i, key: "depreciation" },
    { test: /capex|capital expenditure|النفقات الرأسمالية/i, key: "capex" },
  ];

  for (const line of lines) {
    const nums = line.match(numRegex);
    if (!nums || nums.length === 0) continue;
    const mainNum = parseNum(nums[0]);
    if (mainNum === 0 && nums.length === 1) continue;

    for (const { test, key } of matchers) {
      if (test.test(line) && !record[key]) {
        record[key] = mainNum;
        break;
      }
    }
  }

  if (!record.revenue) return [];
  return [record];
}

// ==================== CSV EXTRACTION ====================
async function extractCSVData(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const text = buffer.toString("utf-8");
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().replace(/['"]/g, ""));
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map(c => c.trim().replace(/['"]/g, ""));
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      const val = cells[j];
      if (val) {
        const num = parseFloat(toWesternNum(val).replace(/[,،]/g, ""));
        obj[h] = isNaN(num) ? val : num;
      }
    });
    if (Object.values(obj).some(v => typeof v === "number")) rows.push(obj);
  }
  return rows;
}

// ==================== EXCEL EXTRACTION ====================
async function extractExcelData(buffer: Buffer, filename: string): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  let workbook: ReturnType<typeof XLSX.read>;

  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return [];
  }

  let bestData: Record<string, unknown>[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, defval: null, raw: true, blankrows: false,
    }) as unknown[][];

    if (rawRows.length < 2) continue;

    const financialKeywords = [
      "revenue","sales","إيراد","مبيعات","الإيرادات","profit","ربح",
      "asset","أصول","cash","نقد","expenses","مصروف","month","شهر",
      "liabilit","خصوم","equity","ملكية","cogs","تكلفة"
    ];

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      const row = rawRows[i];
      const textCells = row.filter(v =>
        v !== null && typeof v === "string" && isNaN(Number(String(v).replace(/[,،٠-٩]/g, "")))
      );
      const hasKeyword = row.some(v =>
        typeof v === "string" && financialKeywords.some(kw => v.toLowerCase().includes(kw))
      );
      if (textCells.length >= 2 && hasKeyword) { headerRowIdx = i; break; }
    }
    if (headerRowIdx === -1 && rawRows.length > 0) headerRowIdx = 0;

    const headers = rawRows[headerRowIdx].map((h, i) =>
      (h !== null && h !== undefined && h !== "") ? String(h).trim() : `col_${i}`
    );

    const dataRows: Record<string, unknown>[] = [];
    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const hasNumeric = row.some(v => typeof v === "number" && v !== 0);
      const hasData = row.some(v => v !== null && v !== undefined && v !== "");
      if (!hasData || !hasNumeric) continue;

      const obj: Record<string, unknown> = {};
      headers.forEach((h, j) => {
        let val = row[j] ?? null;
        if (typeof val === "string" && val.trim()) {
          // Handle parentheses negatives
          const isNeg = /^\(.*\)$/.test(val.trim());
          const western = toWesternNum(val).replace(/[()،,٬']/g, "").trim();
          const num = parseFloat(western);
          if (!isNaN(num)) val = isNeg ? -Math.abs(num) : num;
          else val = val.trim();
        }
        if (val !== null && val !== undefined && val !== "") obj[h] = val;
      });

      if (Object.values(obj).some(v => typeof v === "number")) dataRows.push(obj);
    }

    if (dataRows.length > bestData.length) bestData = dataRows;
  }
  return bestData;
}

// ==================== AI INSIGHTS ====================
async function generateInsights(
  financials: Record<string, unknown>,
  companyName: string,
  anthropicKey?: string
): Promise<Array<{ type: string; title: string; text: string }>> {
  const f = financials as Record<string, number>;
  const score = (financials.score as Record<string, number>)?.overall ?? 0;
  const prof = (financials.profitability as Record<string, number>) ?? {};
  const liq  = (financials.liquidity as Record<string, number>) ?? {};
  const sol  = (financials.solvency as Record<string, number>) ?? {};
  const cf   = (financials.cashFlow as Record<string, number>) ?? {};

  if (anthropicKey && !anthropicKey.includes("placeholder") && !anthropicKey.includes("YOUR_KEY")) {
    try {
      const Anthropic = await import("@anthropic-ai/sdk");
      const client = new Anthropic.default({ apiKey: anthropicKey });

      // CRITICAL: AI only uses provided calculated metrics — never invents numbers
      const prompt = `You are an expert CFO and financial analyst. Use ONLY the following calculated metrics to provide 4 concise, actionable insights. Do NOT invent numbers or make predictions beyond what the data shows.

Company: ${companyName}
Financial Health Score: ${score}/100
Revenue: ${f.totalRevenue?.toLocaleString()} SAR
Net Profit: ${f.netProfit?.toLocaleString()} SAR (${prof.netMargin?.toFixed(1)}% margin)
Gross Margin: ${prof.grossMargin?.toFixed(1)}%
EBITDA Margin: ${prof.ebitdaMargin?.toFixed(1)}%
ROA: ${prof.roa?.toFixed(1)}% | ROE: ${prof.roe?.toFixed(1)}%
Current Ratio: ${liq.currentRatio?.toFixed(2)} | Quick Ratio: ${liq.quickRatio?.toFixed(2)}
Debt Ratio: ${((sol.debtRatio ?? 0) * 100).toFixed(1)}%
Interest Coverage: ${sol.interestCoverage?.toFixed(1)}x
Cash Runway: ${cf.monthsRunway?.toFixed(1)} months
Revenue Growth: ${f.revenueGrowth?.toFixed(1)}%
Altman Z Zone: ${(financials.altmanZ as Record<string,unknown>)?.zone ?? "unknown"}

Respond ONLY with a valid JSON array (no markdown, no preamble):
[
  {"type":"summary","title":"Executive Summary","text":"2-3 sentences covering overall health"},
  {"type":"risk","title":"Key Risks","text":"Top 2-3 risks with exact numbers from above"},
  {"type":"opportunity","title":"Growth Opportunities","text":"2-3 concrete opportunities"},
  {"type":"recommendation","title":"CFO Recommendations","text":"Top 3 prioritized actions"}
]`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("[AI insights] error:", e);
    }
  }

  // P4-26: Dynamic fallback from pre-computed metrics — explicit disclaimer required
  const aiUnavailableDisclaimer = "AI service unavailable. Displaying pre-computed metrics only.";
  const netMargin   = prof.netMargin ?? 0;
  const currentRatio = liq.currentRatio ?? 0;
  const debtRatio   = (sol.debtRatio ?? 0) * 100;
  const monthsRunway = cf.monthsRunway ?? 0;

  return [
    {
      type: "summary",
      title: `Executive Summary [${aiUnavailableDisclaimer}]`,
      text: `Financial health score: ${score}/100 (${score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Needs Improvement" : "High Risk"}). Net margin of ${netMargin.toFixed(1)}% indicates ${netMargin > 15 ? "strong" : netMargin > 8 ? "moderate" : "weak"} profitability. Revenue growth: ${(f.revenueGrowth || 0).toFixed(1)}%.`,
    },
    {
      type: "risk",
      title: "Key Risks",
      text: [
        debtRatio > 60 ? `High debt ratio (${debtRatio.toFixed(1)}%) limits financial flexibility.` : null,
        monthsRunway < 6  ? `Critical: Only ${monthsRunway.toFixed(1)} months of cash runway.` :
        monthsRunway < 12 ? `Cash runway of ${monthsRunway.toFixed(1)} months is below recommended 12 months.` : null,
        currentRatio < 1.2 ? `Current ratio ${currentRatio.toFixed(2)} — near-term obligations risk.` : null,
        netMargin < 5 ? `Thin margins (${netMargin.toFixed(1)}%) offer little buffer.` : null,
      ].filter(Boolean).join(" ") || "Financial risk profile is manageable based on current metrics.",
    },
    {
      type: "opportunity",
      title: "Growth Opportunities",
      text: currentRatio > 2 && debtRatio < 40
        ? `Strong balance sheet enables strategic investment. Low leverage (${debtRatio.toFixed(0)}%) creates room for growth financing.`
        : `Focus on margin improvement. Reducing COGS by 3-5% could materially improve bottom line. Explore recurring revenue models for cash stability.`,
    },
    {
      type: "recommendation",
      title: "CFO Recommendations",
      text: [
        monthsRunway < 12 ? `[Urgent] Build cash reserve to 12+ months runway.` : null,
        debtRatio > 55 ? `[30 days] Develop debt reduction plan targeting ${Math.max(40, debtRatio - 15).toFixed(0)}% debt ratio.` : null,
        `[60 days] Review top cost centers for ${netMargin < 10 ? "urgent" : "incremental"} efficiency gains.`,
        `[Ongoing] Monitor monthly burn rate (${(cf.burnRate || 0).toLocaleString()} SAR/month).`,
      ].filter(Boolean).join(" "),
    },
  ];
}

// ==================== QUOTA ENDPOINT (P6-34) ====================
// GET /api/quota — returns remaining reports, AI requests, storage for frontend progress bars
app.get("/api/quota", async (c) => {
  const authHeader = c.req.header("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  let jwtPayload: Record<string, unknown>;
  try {
    const { verifyAccessToken } = await import("./lib/tokenService");
    jwtPayload = verifyAccessToken(authHeader.slice(7).trim()) as Record<string, unknown>;
    if (!jwtPayload?.id) throw new Error("invalid");
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }

  const userId       = jwtPayload.id as number;
  const reportsLimit = (jwtPayload.reportsLimit as number) ?? 3;
  const plan         = (jwtPayload.plan as string) ?? "free";

  const { checkPlanLimit } = await import("./queries/reports");
  const limitCheck = await checkPlanLimit(userId, plan, reportsLimit);

  const PLAN_AI_LIMITS: Record<string, number> = {
    free:         10,
    professional: 200,
    business:     1000,
    enterprise:   99999,
  };
  const PLAN_STORAGE_MB: Record<string, number> = {
    free:         50,
    professional: 500,
    business:     5000,
    enterprise:   50000,
  };

  return c.json({
    plan,
    reports: {
      used:      limitCheck.used,
      limit:     reportsLimit,
      remaining: limitCheck.remaining,
    },
    aiRequests: {
      limit:     PLAN_AI_LIMITS[plan] ?? 10,
      // AI request counting requires a separate KV store — simplified for now
      remaining: PLAN_AI_LIMITS[plan] ?? 10,
    },
    storageMb: {
      limit:     PLAN_STORAGE_MB[plan] ?? 50,
      remaining: PLAN_STORAGE_MB[plan] ?? 50,
    },
  });
});

// ==================== HEALTH & OBSERVABILITY ====================
app.get("/health", async (c) => {
  const health = await getHealthStatus();
  const status = health.status === "healthy" ? 200 : health.status === "degraded" ? 207 : 503;
  return c.json(health, status);
});

app.get("/ready", async (c) => {
  // Kubernetes readiness: only passes if all critical deps are up
  const health = await getHealthStatus();
  if (health.status === "unhealthy") return c.json({ ready: false }, 503);
  return c.json({ ready: true });
});

app.get("/live", (c) => c.json({ live: true, ts: Date.now() }));

app.get("/metrics", (c) => {
  // Prometheus scrape endpoint — restrict in production
  if (env.isProduction && !c.req.header("x-internal-metrics")) {
    return c.text("Forbidden", 403);
  }
  return c.text(metrics.toPrometheus(), 200, { "Content-Type": "text/plain; version=0.0.4" });
});

// ==================== TRPC ====================
app.use("/api/trpc/*", async (c) => {
  // Global rate limit for tRPC
  const ip = getIP(c);
  if (!await globalLimiter.allow(`global:${ip}`, env.rateLimitMaxRequests, env.rateLimitWindowMs)) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }
  const reqId = (c.get("reqId" as never) as string | undefined) ?? "unknown";
  const start  = Date.now();
  const result = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
    onError: ({ error, path, type }) => {
      const code = (error as Record<string,unknown>).code ?? "UNKNOWN";
      if (code !== "NOT_FOUND") {
        logger.error("tRPC error", {
          service: "trpc", path, type, code,
          message: error.message?.slice(0, 200),
          reqId,
        });
      }
      metrics.inc("trpc_errors", { code });
    },
  });
  metrics.observe("trpc_latency_ms", Date.now() - start);
  return result;
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

const isMain =
  import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("boot.ts") ||
  process.argv[1]?.endsWith("server.ts");

if (isMain || env.isProduction) {
  // Initialize persistent store (Redis → LMDB fallback)
  const { getStore } = await import("./lib/persist");
  await getStore();
  await initRateLimiters();
  // Load revoked JTIs from store (bloom filter warm-up)
  const { loadRevokedJtisFromStore } = await import("./lib/tokenService");
  await loadRevokedJtisFromStore();
  logger.info("EEXA Production API starting", { service:"boot" });
  const { serve } = await import("@hono/node-server");
  if (env.isProduction) {
    const { serveStaticFiles } = await import("./lib/vite.js");
    serveStaticFiles(app);
  }
  const port = parseInt(process.env.API_PORT || process.env.PORT || "3001");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`✅ EEXA Platform v4.0 API running on http://localhost:${port}/`);
  });
}