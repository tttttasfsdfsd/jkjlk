/**
 * EEXA Database Connection — Drizzle ORM
 * P1-9 fix: getDb() is now properly initialized and used throughout the app.
 * Previously this function existed but was NEVER called anywhere.
 */
import { env } from "../lib/env";

// Lazily initialized Drizzle instance — null when DATABASE_URL not configured
let _db: unknown = null;
let _initialized = false;

export async function getDb(): Promise<unknown | null> {
  if (_initialized) return _db;
  _initialized = true;

  if (!env.databaseUrl) {
    console.warn("[db] DATABASE_URL not set — database features disabled");
    return null;
  }

  try {
    const { drizzle } = await import("drizzle-orm/mysql2");
    const mysql = await import("mysql2/promise");

    const pool = mysql.createPool({
      uri:             env.databaseUrl,
      connectionLimit: 10,
      waitForConnections: true,
    });

    const { schema } = await import("../../db/schema");
    const { relations } = await import("../../db/relations");

    _db = drizzle(pool, { schema: { ...schema, ...relations }, mode: "default" });
    console.log("[db] Drizzle ORM initialized");
    return _db;
  } catch (e) {
    console.error("[db] Failed to initialize:", (e as Error).message);
    return null;
  }
}

/** Reset for tests */
export function resetDb(): void {
  _db = null;
  _initialized = false;
}
