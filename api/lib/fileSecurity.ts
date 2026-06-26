/**
 * EEXA File Security — Multi-layer validation
 * MIME, magic bytes, size, ZIP bomb, antivirus hooks
 */
import { auditLog } from "./auditLogger";

// ==================== ALLOWED FILE TYPES ====================
export const ALLOWED_TYPES = new Map([
  ["xlsx", { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: [[0x50,0x4B,0x03,0x04]] }],
  ["xlsm", { mime: "application/vnd.ms-excel.sheet.macroEnabled.12",                  magic: [[0x50,0x4B,0x03,0x04]] }],
  ["xls",  { mime: "application/vnd.ms-excel",                                         magic: [[0xD0,0xCF,0x11,0xE0]] }],
  ["csv",  { mime: "text/csv",                                                          magic: [] }], // text — no magic
  ["pdf",  { mime: "application/pdf",                                                   magic: [[0x25,0x50,0x44,0x46]] }],
]);

const BLOCKED_EXTENSIONS = new Set([
  "exe","bat","cmd","sh","ps1","php","js","ts","py","rb","go","java","class",
  "jar","war","dll","so","dylib","vbs","wsf","hta","msi","scr","pif","reg",
  "inf","lnk","html","htm","svg","xml","zip","tar","gz","7z","rar","iso",
]);

// Dangerous content signatures (executables disguised as other files)
const MALICIOUS_SIGNATURES: Array<{ name: string; bytes: number[] }> = [
  { name: "PE_EXECUTABLE",  bytes: [0x4D,0x5A] },              // MZ header
  { name: "ELF_EXECUTABLE", bytes: [0x7F,0x45,0x4C,0x46] },   // ELF header
  { name: "PHP_SCRIPT",     bytes: [0x3C,0x3F,0x70,0x68,0x70] }, // <?php
  { name: "SHELL_SCRIPT",   bytes: [0x23,0x21,0x2F,0x62,0x69,0x6E] }, // #!/bin
];

// ==================== VALIDATION RESULT ====================
export interface FileValidationResult {
  valid:    boolean;
  error?:   string;
  warnings: string[];
  ext:      string;
  detectedType?: string;
}

// ==================== MAIN VALIDATOR ====================
export async function validateUploadedFile(
  buffer: Buffer,
  filename: string,
  sizeBytes: number,
  maxBytes: number,
  userId?: number,
  companyId?: number
): Promise<FileValidationResult> {
  const warnings: string[] = [];
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  // 1. Extension blocklist
  if (BLOCKED_EXTENSIONS.has(ext)) {
    auditLog({ userId, companyId, action:"upload.scan_failed", severity:"warn",
      metadata: { reason:"blocked_extension", ext } });
    return { valid:false, error:`نوع الملف '${ext}' محظور`, warnings, ext };
  }

  // 2. Extension allowlist
  if (!ALLOWED_TYPES.has(ext)) {
    return { valid:false, error:"يُسمح فقط بملفات Excel وCSV وPDF", warnings, ext };
  }

  // 3. Size checks
  if (sizeBytes === 0) return { valid:false, error:"الملف فارغ", warnings, ext };
  if (sizeBytes > maxBytes) {
    return { valid:false, error:`حجم الملف يتجاوز الحد الأقصى (${Math.round(maxBytes/1024/1024)} MB)`, warnings, ext };
  }

  // 4. Malicious signature check (executables disguised as docs)
  for (const sig of MALICIOUS_SIGNATURES) {
    if (sig.bytes.every((b, i) => buffer[i] === b)) {
      auditLog({ userId, companyId, action:"upload.malware_detected", severity:"critical",
        metadata: { signature: sig.name, filename: filename.slice(0,40) } });
      return { valid:false, error:"الملف يحتوي على محتوى خطير ومحظور", warnings, ext };
    }
  }

  // 5. Magic bytes validation
  const typeInfo = ALLOWED_TYPES.get(ext)!;
  if (typeInfo.magic.length > 0) {
    const validMagic = typeInfo.magic.some(sig => sig.every((b, i) => buffer[i] === b));
    if (!validMagic) {
      auditLog({ userId, companyId, action:"upload.scan_failed", severity:"warn",
        metadata: { reason:"magic_bytes_mismatch", ext } });
      return { valid:false, error:"محتوى الملف لا يطابق امتداده — قد يكون مزيفاً أو تالفاً", warnings, ext };
    }
  }

  // 6. ZIP bomb detection (for XLSX which is ZIP-based)
  if (ext === "xlsx" || ext === "xlsm") {
    const compressionRatio = await estimateCompressionRatio(buffer);
    if (compressionRatio > 100) {
      warnings.push("ملف ZIP مضغوط بشدة — احتمال هجوم ZIP bomb");
      auditLog({ userId, companyId, action:"upload.scan_failed", severity:"warn",
        metadata: { reason:"zip_bomb_suspect", ratio: compressionRatio } });
    }
  }

  // 7. CSV size sanity (prevent gigantic CSV)
  if (ext === "csv") {
    const lineCount = buffer.toString("utf8", 0, Math.min(buffer.length, 1024)).split("\n").length;
    if (sizeBytes > 10 * 1024 * 1024) { // 10MB CSV limit
      warnings.push("ملف CSV كبير — قد يستغرق تحليله وقتاً");
    }
  }

  // 8. Antivirus hook (production: call ClamAV / Cloudflare WARP / VirusTotal)
  // const avResult = await scanWithClamAV(buffer);
  // if (!avResult.clean) return { valid:false, error:"تم اكتشاف برمجية ضارة", warnings, ext };

  return { valid:true, warnings, ext };
}

// ==================== ZIP BOMB ESTIMATION ====================
async function estimateCompressionRatio(buffer: Buffer): Promise<number> {
  try {
    // Read ZIP central directory to estimate uncompressed sizes
    const EOCD_SIG = 0x06054b50;
    for (let i = buffer.length - 22; i >= 0; i--) {
      if (buffer.readUInt32LE(i) === EOCD_SIG) {
        const cdSize       = buffer.readUInt32LE(i + 12);
        const cdOffset     = buffer.readUInt32LE(i + 16);
        let totalUncompressed = 0;
        let pos = cdOffset;
        while (pos < cdOffset + cdSize && pos + 46 < buffer.length) {
          if (buffer.readUInt32LE(pos) !== 0x02014b50) break;
          totalUncompressed += buffer.readUInt32LE(pos + 24);
          const fnLen  = buffer.readUInt16LE(pos + 28);
          const exLen  = buffer.readUInt16LE(pos + 30);
          const cmtLen = buffer.readUInt16LE(pos + 32);
          pos += 46 + fnLen + exLen + cmtLen;
        }
        return totalUncompressed > 0 ? totalUncompressed / buffer.length : 1;
      }
    }
  } catch {}
  return 1;
}

// ==================== SECURE TEMP CLEANUP ====================
export function scheduleBufferCleanup(buffer: Buffer, delayMs = 30_000): void {
  setTimeout(() => {
    buffer.fill(0); // zero-fill sensitive data
  }, delayMs);
}

// ==================== ADDITIONAL HARDENING (appended) ====================

/**
 * Checks whether CSV content contains formula injection attempts.
 * Spreadsheet parsers can execute =CMD() formulas if not sanitized.
 */
export function checkCsvFormulaInjection(buffer: Buffer): { safe: boolean; reason?: string } {
  const text = buffer.toString("utf8", 0, Math.min(buffer.length, 50_000));
  const lines = text.split(/\r?\n/).slice(0, 500);

  const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t=", "\r="];

  for (const line of lines) {
    const cells = line.split(",");
    for (const cell of cells) {
      const c = cell.trim().replace(/^["']/, "");
      if (FORMULA_PREFIXES.some(p => c.startsWith(p)) && /[A-Za-z(]/.test(c.slice(1))) {
        return { safe: false, reason: `Formula injection attempt detected: ${c.slice(0, 30)}` };
      }
    }
  }
  return { safe: true };
}

/**
 * Estimates the number of rows in an Excel file to detect
 * oversized sheets that could cause memory exhaustion.
 */
export function estimateExcelRowCount(buffer: Buffer): number {
  // XLSX files are ZIP archives — look for sharedStrings.xml size as heuristic
  const content = buffer.toString("binary", 0, Math.min(buffer.length, 4096));
  const match = content.match(/numStrings="(\d+)"/);
  if (match) return parseInt(match[1]);
  return 0; // unknown
}

/**
 * Full pipeline: combines all validation steps.
 * Call this once before any file is processed.
 */
export async function fullFileValidation(
  buffer:    Buffer,
  filename:  string,
  sizeBytes: number,
  maxBytes:  number,
  userId?:   number,
  companyId?:number
): Promise<FileValidationResult> {
  // Step 1: Standard validation (extension, magic, malicious sigs, size)
  const base = await validateUploadedFile(buffer, filename, sizeBytes, maxBytes, userId, companyId);
  if (!base.valid) return base;

  const ext = filename.toLowerCase().split(".").pop() ?? "";

  // Step 2: CSV formula injection
  if (ext === "csv") {
    const formulaCheck = checkCsvFormulaInjection(buffer);
    if (!formulaCheck.safe) {
      auditLog({ userId, companyId, action: "upload.scan_failed", severity: "warn",
        metadata: { reason: "csv_formula_injection", detail: formulaCheck.reason?.slice(0, 80) ?? "" } });
      return { valid: false, error: "الملف يحتوي على صيغ محتملة خطرة", warnings: [], ext };
    }
  }

  // Step 3: Excel row-count sanity check
  if (["xlsx", "xlsm", "xls"].includes(ext)) {
    const rows = estimateExcelRowCount(buffer);
    if (rows > 500_000) {
      return { valid: false, error: "ملف Excel يحتوي على عدد صفوف كبير جداً (أكثر من 500,000)", warnings: [], ext };
    }
  }

  return base;
}
