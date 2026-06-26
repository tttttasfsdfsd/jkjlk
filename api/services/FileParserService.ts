/**
 * FileParserService — P2-12 extraction from boot.ts
 * Handles all file parsing: PDF (including scanned OCR), Excel, CSV.
 * P4-22: Scanned PDF OCR via tesseract.js
 * P4-23: Arabic text support via tesseract.js ara language pack
 */

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
function toWesternNum(s: string): string {
  return s.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => String(ARABIC_INDIC.indexOf(d)));
}
function parseNum(s: string): number {
  const negative = /^\(.*\)$/.test(s.trim());
  const cleaned = toWesternNum(s).replace(/[()،,\s']/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

const FIELD_MATCHERS: Array<{ test: RegExp; key: string }> = [
  { test: /revenue|sales|إيراد|مبيعات|الإيرادات|المبيعات/i,                    key: "revenue" },
  { test: /net (income|profit)|صافي (الربح|الدخل)|الربح الصافي/i,              key: "netIncome" },
  { test: /cost of (goods|revenue|sales)|تكلفة (البضاعة|المبيعات|الإيرادات)/i,  key: "cogs" },
  { test: /gross profit|الربح الإجمالي|مجمل الربح/i,                           key: "grossProfit" },
  { test: /ebitda/i,                                                            key: "ebitda" },
  { test: /ebit|operating income|الربح التشغيلي/i,                             key: "ebit" },
  { test: /operating exp|مصاريف تشغيل/i,                                       key: "operatingExpenses" },
  { test: /interest exp|مصاريف فوائد/i,                                        key: "interestExpense" },
  { test: /\btax\b|ضريبة/i,                                                    key: "tax" },
  { test: /total assets|إجمالي الأصول/i,                                       key: "totalAssets" },
  { test: /current assets|الأصول المتداولة/i,                                  key: "currentAssets" },
  { test: /total liabilit|إجمالي الخصوم/i,                                     key: "totalLiabilities" },
  { test: /current liabilit|الخصوم المتداولة/i,                                key: "currentLiabilities" },
  { test: /total equity|حقوق الملكية/i,                                        key: "totalEquity" },
  { test: /\bcash\b|النقد/i,                                                   key: "cash" },
  { test: /inventory|مخزون/i,                                                  key: "inventory" },
  { test: /accounts receivable|ذمم مدينة/i,                                    key: "accountsReceivable" },
  { test: /accounts payable|ذمم دائنة/i,                                       key: "accountsPayable" },
  { test: /retained earnings|الأرباح المحتجزة/i,                               key: "retainedEarnings" },
  { test: /operating cash|التدفق النقدي التشغيلي/i,                            key: "operatingCashFlow" },
  { test: /depreciation|الإهلاك/i,                                             key: "depreciation" },
  { test: /capex|capital expenditure/i,                                         key: "capex" },
];

function parsePDFTextToRows(text: string): Record<string, unknown>[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const record: Record<string, unknown> = { month: "Period 1" };
  const numRegex = /[\d٠-٩][\d٠-٩,،.]*(?:\.\d+)?/g;
  for (const line of lines) {
    const nums = line.match(numRegex);
    if (!nums?.length) continue;
    const mainNum = parseNum(nums[0]);
    if (mainNum === 0 && nums.length === 1) continue;
    for (const { test, key } of FIELD_MATCHERS) {
      if (test.test(line) && !record[key]) { record[key] = mainNum; break; }
    }
  }
  if (!record.revenue) return [];
  return [record];
}

function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

export type ParseResult =
  | { ok: true;  rows: Record<string, unknown>[] }
  | { ok: false; error: string };

// ==================== PDF PARSER (P4-22/23) ====================
export async function parsePDF(bytes: ArrayBuffer): Promise<ParseResult> {
  let fullText = "";

  // Step 1: pdfjs text layer extraction
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await (pdfjsLib.getDocument({ data: new Uint8Array(bytes) })).promise;
    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items   = content.items as Array<{ str: string; transform: number[] }>;
      const lineMap = new Map<number, string[]>();
      for (const item of items) {
        const y = Math.round(item.transform[5]);
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y)!.push(item.str);
      }
      for (const y of Array.from(lineMap.keys()).sort((a, b) => b - a)) {
        fullText += lineMap.get(y)!.join(" ") + "\n";
      }
    }
  } catch (e) {
    console.error("[pdf] pdfjs failed:", e);
  }

  // Step 2: If pdfjs gave too little text → scanned PDF, attempt OCR (P4-22/23)
  if (fullText.replace(/\s/g, "").length < 50) {
    console.warn("[pdf] Scanned PDF detected — attempting OCR");
    try {
      const Tesseract = await import("tesseract.js");
      // P4-23: Detect Arabic and switch language pack
      const lang = isArabicText(fullText) ? "ara" : "eng";
      let ocrText = "";

      try {
        // Render PDF pages to PNG via pdfjs + canvas for best OCR quality
        const pdfjsLib    = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const { createCanvas } = await import("canvas");
        const pdf = await (pdfjsLib.getDocument({ data: new Uint8Array(bytes) })).promise;

        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
          const page     = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas   = createCanvas(viewport.width, viewport.height);
          await page.render({
            canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
            viewport,
          }).promise;
          const { data: { text } } = await Tesseract.recognize(
            canvas.toBuffer("image/png"), lang, { logger: () => {} }
          );
          ocrText += text + "\n";
        }
      } catch {
        // canvas not available — pass raw bytes directly
        const { data: { text } } = await Tesseract.recognize(
          Buffer.from(bytes), lang, { logger: () => {} }
        );
        ocrText = text;
      }

      if (ocrText.replace(/\s/g, "").length < 20) {
        return { ok: false, error: "Scanned PDF detected — OCR failed. Please upload a text-based PDF." };
      }
      fullText = ocrText;
    } catch {
      return { ok: false, error: "Scanned PDF detected — OCR failed. Please upload a text-based PDF." };
    }
  }

  const rows = parsePDFTextToRows(fullText);
  if (!rows.length) {
    return { ok: false, error: "لم يتم العثور على بيانات مالية في الملف. تأكد أن الملف يحتوي على قوائم مالية." };
  }
  return { ok: true, rows };
}

// ==================== EXCEL PARSER ====================
export async function parseExcel(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const wb   = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rows: Record<string, unknown>[] = [];
  for (const sheetName of wb.SheetNames.slice(0, 3)) {
    const ws   = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
    rows.push(...data);
    if (rows.length > 5000) break;
  }
  return rows;
}

// ==================== CSV PARSER ====================
export async function parseCSV(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const text    = buffer.toString("utf-8");
  const lines   = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/['"]/g, ""));
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < Math.min(lines.length, 5001); i++) {
    const vals = lines[i].split(",");
    const row: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      const v = (vals[j] ?? "").trim().replace(/['"]/g, "");
      row[h]  = v === "" ? null : isNaN(Number(v)) ? v : Number(v);
    });
    rows.push(row);
  }
  return rows;
}
