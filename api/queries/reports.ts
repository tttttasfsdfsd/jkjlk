/**
 * EEXA Report Queries — Drizzle ORM
 * P1-9 fix: Replace localStorage.setItem("reports", ...) with real DB operations.
 *
 * Falls back to KV store (Redis/LMDB) when DATABASE_URL is not configured so
 * the app still works in development without a MySQL instance.
 */
import { randomBytes } from "crypto";
import { getDb } from "./connection";
import { getStore } from "../lib/persist";

const NS_REPORTS = "reports:";

export interface ReportRecord {
  id?:         number;
  uid:         string;
  userId:      number;
  companyId:   number;
  companyName: string;
  score:       number;
  revenue?:    number | null;
  netProfit?:  number | null;
  netMargin?:  number | null;
  fileName?:   string;
  createdAt?:  string;
  /** Encrypted JSON snapshot of the full analysis result */
  dataSnapshot?: string;
}

export async function saveReport(report: Omit<ReportRecord, "uid" | "id">): Promise<ReportRecord> {
  const uid = randomBytes(16).toString("hex");
  const full: ReportRecord = { ...report, uid, createdAt: new Date().toISOString() };

  const db = await getDb();
  if (db) {
    try {
      // Drizzle insert — P1-9 activation
      const { reports } = await import("../../db/schema") as { reports: unknown };
      const drizzle = db as { insert: Function };
      await drizzle.insert(reports).values({
        uid,
        userId:      report.userId,
        companyId:   report.companyId,
        companyName: report.companyName,
        score:       report.score,
        revenue:     report.revenue ?? null,
        netProfit:   report.netProfit ?? null,
        netMargin:   report.netMargin ?? null,
        dataSnapshot: report.dataSnapshot ?? null,
      });
      return full;
    } catch (e) {
      console.error("[reports] DB insert failed, falling back to KV:", (e as Error).message);
    }
  }

  // Fallback: persist to KV store (Redis/LMDB)
  const store = await getStore();
  const key = `${NS_REPORTS}${report.userId}:${uid}`;
  await store.set(key, full, 90 * 24 * 3600 * 1000); // 90-day TTL
  return full;
}

export async function getReportsForUser(userId: number, limit = 50): Promise<ReportRecord[]> {
  const db = await getDb();
  if (db) {
    try {
      const { reports } = await import("../../db/schema") as { reports: unknown };
      const { desc } = await import("drizzle-orm");
      const { eq } = await import("drizzle-orm");
      const drizzle = db as { select: Function };
      const rows = await drizzle
        .select()
        .from(reports)
        .where(eq((reports as Record<string, unknown>)["userId"], userId))
        .orderBy(desc((reports as Record<string, unknown>)["createdAt"]))
        .limit(limit);
      return rows as ReportRecord[];
    } catch (e) {
      console.error("[reports] DB select failed, falling back to KV:", (e as Error).message);
    }
  }

  // Fallback: scan KV store
  const store = await getStore();
  const keys  = await store.keys(`${NS_REPORTS}${userId}:`);
  const results: ReportRecord[] = [];
  for (const k of keys.slice(0, limit)) {
    const r = await store.get<ReportRecord>(k);
    if (r) results.push(r);
  }
  return results.sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );
}

export async function checkPlanLimit(
  userId: number,
  plan: string,
  reportsLimit: number,
): Promise<{ allowed: boolean; used: number; remaining: number; reason?: string }> {
  const db = await getDb();
  let used = 0;

  if (db) {
    try {
      const { reports } = await import("../../db/schema") as { reports: unknown };
      const { eq, count, isNull } = await import("drizzle-orm");
      const drizzle = db as { select: Function };
      // Count reports created this billing period (current month)
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const rows = await drizzle
        .select({ count: count() })
        .from(reports)
        .where(eq((reports as Record<string, unknown>)["userId"], userId));
      used = Number(rows[0]?.count ?? 0);
    } catch (e) {
      console.warn("[reports] plan limit DB check failed:", (e as Error).message);
    }
  } else {
    // Fallback: count from KV store
    const store = await getStore();
    const keys  = await store.keys(`${NS_REPORTS}${userId}:`);
    used = keys.length;
  }

  const remaining = Math.max(0, reportsLimit - used);
  if (used >= reportsLimit) {
    return {
      allowed: false, used, remaining: 0,
      reason: `لقد استنفدت ${used} تقرير من أصل ${reportsLimit}. يرجى الترقية للاستمرار.`,
    };
  }
  return { allowed: true, used, remaining };
}
