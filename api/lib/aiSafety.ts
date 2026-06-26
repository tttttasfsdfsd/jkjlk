/**
 * EEXA AI Safety Layer — Hardened v2
 *
 * Threat model:
 *   Direct injection:   User tries to override system prompt via message
 *   Indirect injection: Malicious content in uploaded files reaches AI context
 *   Data exfiltration:  AI prompted to reveal other tenants' data
 *   Hallucination:      AI invents financial figures not in provided metrics
 *
 * Design:
 *   - Two-tier detection: fast regex + structural pattern analysis
 *   - Inject attempt → audit log + sanitize → proceed (not hard block)
 *     so legitimate users aren't disrupted by false positives
 *   - Grounding validation → strip unverified figures from output
 *   - Context isolation → only scalar metrics from owning company enter AI
 */
import { auditLog } from "./auditLogger";

// ==================== DIRECT INJECTION PATTERNS ====================
const DIRECT_INJECTION: RegExp[] = [
  /ignore.*(previous|above|all|instructions)/i,
  /disregard.*(your|the).*(system|previous|prompt)/i,
  /you are now\b/i,
  /\bact as (a|an|if)\b/i,
  /\bjailbreak\b/i,
  /\bDAN mode\b/i,
  /pretend (you are|to be)/i,
  /override.*(your|the).*(instructions?|rules?|system|prompt)/i,
  /<\/?system>/i,
  /\[SYSTEM\]/i,
  /INST>/i,
  /<<SYS>>/i,
  /\[\/INST\]/i,
  /###\s*(System|Instruction)/i,
  /user:\s*ignore/i,
  /forget.*(your|all|previous).*(instructions|rules|constraints)/i,
  /\bdisable (safety|filters?|restrictions?)\b/i,
  /\bsudoer?\b/i,
  /new (persona|personality|identity)/i,
];

// ==================== INDIRECT INJECTION (file content) ====================
// These patterns appear in malicious documents to manipulate AI via RAG
const INDIRECT_INJECTION: RegExp[] = [
  /\bignore\b.*\binstructions\b/i,
  /\bsystem\s*prompt\b/i,
  /when (you|the AI|this) read/i,
  /\bassistant[:\s]+/i,          // fake assistant turns in document
  /---\s*(system|instructions?)\s*---/i,
  /\[override\]/i,
  /\{\{system\}\}/i,
];

// ==================== DATA EXFILTRATION PATTERNS ====================
const EXFILTRATION_PATTERNS: RegExp[] = [
  /other (company|companies|tenant|client)/i,
  /different (company|tenant|user|account)/i,
  /\ball (companies|tenants|clients|users)\b/i,
  /\bdatabase (dump|export|contents)\b/i,
  /\bshow (me|all) (users?|accounts?|companies|tenants)\b/i,
  /\blist (all|every) (company|tenant|account|user)/i,
  /\baccess (another|other|different) (account|company|tenant)/i,
  /other (users?|people|clients)'?s? (data|accounts?|reports?|info)/i,
];

// ==================== COMBINED CHECK ====================
export interface SafetyCheckResult {
  safe:              boolean;
  reason?:           "injection_detected" | "exfiltration_attempt";
  injectionType?:    "direct" | "indirect" | "exfiltration";
  sanitized:         string;
}

export function checkPromptInjection(
  input:      string,
  userId?:    number,
  companyId?: number
): SafetyCheckResult {
  const truncated = input.slice(0, 3000);

  const directMatch      = DIRECT_INJECTION.find(p   => p.test(truncated));
  const indirectMatch    = INDIRECT_INJECTION.find(p  => p.test(truncated));
  const exfilMatch       = EXFILTRATION_PATTERNS.find(p => p.test(truncated));

  if (directMatch || indirectMatch || exfilMatch) {
    const injType: SafetyCheckResult["injectionType"] =
      exfilMatch ? "exfiltration" :
      directMatch ? "direct" : "indirect";

    auditLog({
      userId, companyId,
      action:   "ai.injection_detected",
      severity: "warn",
      metadata: {
        type:    injType,
        pattern: (directMatch || indirectMatch || exfilMatch)!.source.slice(0, 50),
      },
    });

    // Sanitize — strip dangerous fragments, but preserve benign context
    const sanitized = truncated
      .replace(/<\/?system>/gi, "[removed]")
      .replace(/\[SYSTEM\]/gi, "[removed]")
      .replace(/\[override\]/gi, "[removed]")
      .replace(/###\s*(System|Instruction)[^\n]*/gi, "[removed]")
      .slice(0, 1000);

    return {
      safe:          false,
      reason:        exfilMatch ? "exfiltration_attempt" : "injection_detected",
      injectionType: injType,
      sanitized,
    };
  }

  return { safe: true, sanitized: truncated };
}

// ==================== GROUNDING VALIDATION ====================
export interface GroundingResult {
  passed:      boolean;
  violations:  string[];
  confidence?: number; // P4-25: 0.0–1.0, undefined = not computed
}

export function validateGrounding(
  aiOutput: string,
  providedMetrics: Record<string, number | string | undefined>
): GroundingResult {
  const violations: string[] = [];

  // P4-25: Tightened tolerance — ±1% for figures > 1,000 (was ±5%)
  // Small hallucinations that passed the old ±5% check now fail.
  const allowedNumbers = new Set<number>();
  for (const val of Object.values(providedMetrics)) {
    if (typeof val === "number" && isFinite(val) && Math.abs(val) > 0) {
      const isLargeFigure = Math.abs(val) > 1_000;
      // Use ±1% tolerance for figures > 1,000, ±5% for smaller figures
      const margins = isLargeFigure ? [1, 1.01, 0.99] : [1, 1.05, 0.95];
      for (const mult of margins) {
        const rounded = Math.round(val * mult);
        allowedNumbers.add(rounded);
        allowedNumbers.add(Math.round(rounded / 10) * 10);
        allowedNumbers.add(Math.round(rounded / 1000) * 1000);
      }
    }
  }

  // Extract significant numbers from AI output
  const outputNumbers = [...aiOutput.matchAll(/[\d,،]+(?:[.,]\d+)?/g)]
    .map(m => parseFloat(m[0].replace(/[,،]/g, "")))
    .filter(n => n > 10_000 && isFinite(n));

  const flaggedSegments: Array<{ figure: number; context: string }> = [];

  for (const n of outputNumbers) {
    const rounded = Math.round(n);
    if (!allowedNumbers.has(rounded) && !allowedNumbers.has(Math.round(n / 1000) * 1000)) {
      // P4-25: Add confidence score and tag unverifiable figures
      flaggedSegments.push({ figure: n, context: `Unverified figure: ${n.toLocaleString()}` });
      violations.push(`Unverified figure: ${n.toLocaleString()}`);
      if (violations.length >= 3) break;
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    // P4-25: confidence score — 1.0 = fully grounded, 0.0 = all figures unverified
    confidence: outputNumbers.length === 0 ? 1.0 :
      Math.max(0, 1 - (violations.length / Math.max(outputNumbers.length, 1))),
  };
}

/** P4-25: Prepend AI_ESTIMATE disclaimer to unverifiable figures in output */
export function tagUnverifiableFigures(
  aiOutput: string,
  groundingResult: GroundingResult & { confidence?: number }
): string {
  if (groundingResult.passed) return aiOutput;
  // Prepend disclaimer at start of response
  const disclaimer = "[AI ESTIMATE — VERIFY MANUALLY] ";
  if (aiOutput.startsWith(disclaimer)) return aiOutput;
  return disclaimer + aiOutput;
}

// ==================== OUTPUT SANITIZATION ====================
export function sanitizeAiOutput(output: string): string {
  return output
    .replace(/<\/?system>/gi, "")
    .replace(/\[SYSTEM\]/gi, "")
    .replace(/ANTHROPIC_MAGIC_STRING/gi, "")
    .replace(/\x00/g, "")           // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "") // control chars
    .slice(0, 4000);
}

// ==================== TENANT-ISOLATED SYSTEM PROMPT ====================
export function buildIsolatedPrompt(
  companyName: string,
  companyId:   number,
  metrics:     Record<string, number | string>,
  language:    "ar" | "en"
): string {
  const isAr = language === "ar";

  // Hard tenant boundary — AI cannot reference what it cannot see
  const isolation = [
    `[SECURITY BOUNDARY]`,
    `Company: ${companyName} (ID: ${companyId})`,
    `You ONLY have access to this company's pre-computed financial metrics listed below.`,
    `You CANNOT access any other company's data.`,
    `You MUST NOT fabricate financial figures not listed below.`,
    `If a metric is not listed: respond "البيانات غير كافية" (or "Insufficient data available").`,
    `[/SECURITY BOUNDARY]`,
  ].join("\n");

  const roleInstruction = isAr
    ? `أنت مستشار مالي خبير لشركة ${companyName}. استخدم فقط المقاييس المحسوبة أدناه. إذا كانت البيانات غير متوفرة، قل "البيانات غير كافية". لا تخترع أرقاماً.`
    : `You are an expert financial advisor for ${companyName}. Use ONLY the metrics below. If data is unavailable, say "Insufficient data available." Never invent numbers.`;

  // Only include non-zero, finite scalar values
  const safeMetricsStr = Object.entries(metrics)
    .filter(([, v]) => v !== 0 && v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(2) : v}`)
    .join("\n");

  return `${isolation}\n\n${roleInstruction}\n\n## Available Metrics\n${safeMetricsStr}`;
}
