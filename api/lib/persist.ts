/**
 * EEXA Persistence Layer
 *
 * Provides a unified KV store interface backed by:
 *   1. Redis  — when REDIS_URL is set (production, multi-instance)
 *   2. LMDB   — when no Redis (single-instance, persists across restarts)
 *
 * Both backends survive:
 *   ✓ server restart
 *   ✓ process crash (LMDB is memory-mapped, fsync on write)
 *   ✓ horizontal scaling (Redis only — LMDB is single-node)
 *
 * API:
 *   get<T>(key)              → T | null
 *   set(key, value, ttlMs?)  → void
 *   del(key)                 → void
 *   has(key)                 → boolean
 *   increment(key, ttlMs)    → { count, resetAt }
 *   keys(prefix)             → string[]   [LMDB only; Redis uses SCAN]
 */
import * as fs from "fs";
import * as path from "path";

// ==================== INTERFACE ====================
export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  del(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  increment(key: string, ttlMs: number): Promise<{ count: number; resetAt: number }>;
  keys(prefix: string): Promise<string[]>;
  close(): Promise<void>;
}

// ==================== REDIS STORE ====================
class RedisKVStore implements KVStore {
  constructor(private readonly redis: any) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(`eexa:${key}`);
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlMs && ttlMs > 0) {
      await this.redis.psetex(`eexa:${key}`, ttlMs, serialized);
    } else {
      await this.redis.set(`eexa:${key}`, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(`eexa:${key}`);
  }

  async has(key: string): Promise<boolean> {
    return (await this.redis.exists(`eexa:${key}`)) === 1;
  }

  async increment(key: string, ttlMs: number): Promise<{ count: number; resetAt: number }> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(`eexa:${key}`);
    pipeline.pttl(`eexa:${key}`);
    const [[, count], [, pttl]] = await pipeline.exec() as [[null, number], [null, number]];
    if (pttl < 0) await this.redis.pexpire(`eexa:${key}`, ttlMs);
    return { count, resetAt: Date.now() + (pttl > 0 ? pttl : ttlMs) };
  }

  async keys(prefix: string): Promise<string[]> {
    // VULN-005 fix: use SCAN instead of KEYS to avoid blocking the event loop
    const results: string[] = [];
    let cursor = "0";
    const pattern = `eexa:${prefix}*`;
    do {
      const [nextCursor, batch] = await this.redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      for (const k of batch) {
        results.push((k as string).replace(/^eexa:/, ""));
      }
    } while (cursor !== "0");
    return results;
  }

  async close(): Promise<void> { /* Redis client managed externally */ }
}

// ==================== LMDB STORE ====================
class LMDBStore implements KVStore {
  private db: any;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    fs.mkdirSync(this.dbPath, { recursive: true });
    const { open } = await import("lmdb");
    this.db = open({
      path:        this.dbPath,
      compression: false,
      encoding:    "json",
    });
  }

  private expKey(key: string): string { return `_exp:${key}`; }

  private isExpired(key: string): boolean {
    const exp = this.db.get(this.expKey(key)) as number | undefined;
    if (exp == null) return false;
    if (Date.now() > exp) {
      // Lazy delete
      this.db.remove(key);
      this.db.remove(this.expKey(key));
      return true;
    }
    return false;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isExpired(key)) return null;
    const val = this.db.get(key);
    return val === undefined ? null : (val as T);
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await this.db.put(key, value);
    if (ttlMs && ttlMs > 0) {
      await this.db.put(this.expKey(key), Date.now() + ttlMs);
    }
  }

  async del(key: string): Promise<void> {
    await this.db.remove(key);
    await this.db.remove(this.expKey(key));
  }

  async has(key: string): Promise<boolean> {
    if (this.isExpired(key)) return false;
    return this.db.get(key) !== undefined;
  }

  async increment(key: string, ttlMs: number): Promise<{ count: number; resetAt: number }> {
    // VULN-004 fix: use LMDB transaction for atomic read-modify-write
    let count = 1;
    let resetAt = Date.now() + ttlMs;
    await this.db.transaction(() => {
      if (!this.isExpired(key)) {
        const cur = (this.db.get(key) as number | undefined) ?? 0;
        count = cur + 1;
        const exp = (this.db.get(this.expKey(key)) as number | undefined);
        if (exp != null) resetAt = exp;
      }
      this.db.put(key, count);
      this.db.put(this.expKey(key), resetAt);
    });
    return { count, resetAt };
  }

  async keys(prefix: string): Promise<string[]> {
    const results: string[] = [];
    for (const { key } of this.db.getRange({ start: prefix })) {
      if (typeof key !== "string") continue;
      if (!key.startsWith(prefix)) break;
      if (!key.startsWith("_exp:")) results.push(key as string);
    }
    return results;
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

// ==================== SINGLETON FACTORY ====================
let _store: KVStore | null = null;
const LMDB_PATH = process.env.LMDB_PATH ?? path.join(process.cwd(), ".eexa-db");

export async function getStore(): Promise<KVStore> {
  if (_store) return _store;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const { default: Redis } = await import("ioredis");
      const redis = new Redis(redisUrl, {
        lazyConnect:           false,
        maxRetriesPerRequest:  3,
        enableOfflineQueue:    false,
        connectTimeout:        5000,
      });
      await redis.ping();
      _store = new RedisKVStore(redis);
      console.log("[persist] backend: Redis", redisUrl.replace(/:[^:@]*@/, ":***@"));
      return _store;
    } catch (e) {
      console.warn("[persist] Redis connection failed, falling back to LMDB:", (e as Error).message);
    }
  }

  const lmdb = new LMDBStore(LMDB_PATH);
  await lmdb.init();
  _store = lmdb;
  console.log("[persist] backend: LMDB →", LMDB_PATH, "(persistent, single-instance)");
  return _store;
}

/** Force re-initialization (for tests) */
export async function resetStore(): Promise<void> {
  if (_store) {
    try { await _store.close(); } catch { /* ignore close errors */ }
    _store = null;
  }
}
