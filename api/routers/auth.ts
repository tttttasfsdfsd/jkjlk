/**
 * EEXA Auth Router — Production Persistent
 * All user state stored via persist.ts (Redis or LMDB).
 * Zero in-memory Maps for users, sessions, or lockouts.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { createRouter, publicQuery, protectedQuery } from "../middleware";
import {
  signAccessToken,
  issueRefreshTokenSync,
  rotateRefreshTokenSync,
  revokeAllUserTokensSync,
  revokeJtiSync,
  issueCsrfTokenSync,
} from "../lib/tokenService";
import { authLimiter } from "../lib/rateLimiter";
import { auditLog, extractAuditContext } from "../lib/auditLogger";
import { getStore } from "../lib/persist";
import { cache } from "../lib/cache";
import type { AuthUser } from "../middleware";

// ==================== PASSWORD HASHING ====================
const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_KEYLEN     = 32;
const PBKDF2_DIGEST     = "sha256" as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const [, iters, salt, expected] = parts;
    const computed = pbkdf2Sync(password, salt, parseInt(iters, 10), PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch { return false; }
}

// ==================== USER SCHEMA ====================
interface StoredUser {
  id:             number;
  uid:            string;
  email:          string;
  name:           string;
  passwordHash:   string;
  role:           AuthUser["role"];
  plan:           AuthUser["plan"];
  reportsUsed:    number;
  reportsLimit:   number;
  emailVerified:  boolean;
  companyId:      number | null;
  createdAt:      string;
  failedAttempts: number;
  lockedUntil:    number | null;
}

const NS_USER  = "user:email:";    // user:email:{email} → StoredUser
const NS_UID   = "user:uid:";      // user:uid:{uid}     → email (lookup)
const NS_ID    = "user:id:";       // user:id:{id}       → email (lookup)
const NS_COUNT = "user:count";     // auto-increment ID

const PLAN_LIMITS: Record<AuthUser["plan"], number> = {
  free: 3, professional: 999, business: 9999, enterprise: 999999,
};
const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60_000;
const USER_TTL   = 5 * 365 * 24 * 3600 * 1000; // 5 years

// ==================== DB ACCESSORS ====================
async function dbGetByEmail(email: string): Promise<StoredUser | null> {
  const store = await getStore();
  return store.get<StoredUser>(NS_USER + email.toLowerCase());
}

async function dbGetByUid(uid: string): Promise<StoredUser | null> {
  const store = await getStore();
  const email = await store.get<string>(NS_UID + uid);
  if (!email) return null;
  return store.get<StoredUser>(NS_USER + email);
}

async function dbGetById(id: number): Promise<StoredUser | null> {
  const store = await getStore();
  const email = await store.get<string>(NS_ID + String(id));
  if (!email) return null;
  return store.get<StoredUser>(NS_USER + email);
}

async function dbSave(user: StoredUser): Promise<void> {
  const store = await getStore();
  await store.set(NS_USER + user.email, user, USER_TTL);
  await store.set(NS_UID  + user.uid,   user.email, USER_TTL);
  await store.set(NS_ID   + user.id,    user.email, USER_TTL);
}

async function dbNextId(): Promise<number> {
  const store = await getStore();
  const rec   = await store.increment(NS_COUNT, 999 * 24 * 3600 * 1000);
  return rec.count;
}

// ==================== INPUT SCHEMAS ====================
const SignUpSchema = z.object({
  email:    z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(8).max(128)
    .refine(p => /[A-Z]/.test(p), { message: "كلمة المرور تحتاج حرف كبير" })
    .refine(p => /[0-9]/.test(p), { message: "كلمة المرور تحتاج رقم" }),
  name:     z.string().min(2).max(100).trim(),
});

const SignInSchema = z.object({
  email:    z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(1).max(128),
});

// ==================== HELPERS ====================
function publicUser(u: StoredUser) {
  return {
    id: u.id, uid: u.uid, email: u.email, name: u.name,
    role: u.role, plan: u.plan,
    reportsUsed: u.reportsUsed, reportsLimit: u.reportsLimit,
    emailVerified: u.emailVerified, companyId: u.companyId,
  };
}

function buildPayload(u: StoredUser, sessionId: string) {
  return {
    id: u.id, uid: u.uid, email: u.email, role: u.role, plan: u.plan,
    companyId: u.companyId, sessionId,
    reportsUsed: u.reportsUsed, reportsLimit: u.reportsLimit,
  };
}

// ==================== ROUTER ====================
export const authRouter = createRouter({

  // ── SIGN UP ────────────────────────────────────────────────────────────────
  signUp: publicQuery
    .input(SignUpSchema)
    .mutation(async ({ input, ctx }) => {
      const { ipAddress, userAgent } = extractAuditContext(ctx.req);

      if (!await authLimiter.allow(`signup:${ipAddress}`, 5, 15 * 60_000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "محاولات كثيرة. حاول بعد 15 دقيقة." });
      }

      if (await dbGetByEmail(input.email)) {
        await new Promise(r => setTimeout(r, 200 + Math.random() * 150));
        throw new TRPCError({ code: "CONFLICT", message: "البريد الإلكتروني مسجّل مسبقاً" });
      }

      const uid  = randomBytes(16).toString("hex");
      const id   = await dbNextId();
      const user: StoredUser = {
        id, uid, email: input.email, name: input.name,
        passwordHash:   hashPassword(input.password),
        role:           "sme_owner",
        plan:           "free",
        reportsUsed:    0,
        reportsLimit:   PLAN_LIMITS.free,
        emailVerified:  false,
        companyId:      null,
        createdAt:      new Date().toISOString(),
        failedAttempts: 0,
        lockedUntil:    null,
      };
      await dbSave(user);

      const sessionId   = randomBytes(16).toString("hex");
      const accessToken = signAccessToken(buildPayload(user, sessionId), 900);
      const rt          = issueRefreshTokenSync(user.id, sessionId, buildPayload(user, sessionId));
      const csrfToken   = issueCsrfTokenSync(sessionId);

      auditLog({ userId: user.id, action: "auth.signup", severity: "info",
        metadata: { ip: ipAddress } });

      return { accessToken, refreshToken: rt.token, csrfToken, user: publicUser(user) };
    }),

  // ── SIGN IN ────────────────────────────────────────────────────────────────
  signIn: publicQuery
    .input(SignInSchema)
    .mutation(async ({ input, ctx }) => {
      const { ipAddress, userAgent } = extractAuditContext(ctx.req);

      if (!await authLimiter.allow(`signin:${ipAddress}`, 10, 15 * 60_000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "محاولات كثيرة. حاول بعد 15 دقيقة." });
      }

      const DUMMY = "pbkdf2$120000$" + "00".repeat(16) + "$" + "00".repeat(32);
      const found = await dbGetByEmail(input.email);
      const valid = verifyPassword(input.password, found?.passwordHash ?? DUMMY);

      if (!found || !valid) {
        if (found) {
          found.failedAttempts++;
          if (found.failedAttempts >= MAX_FAILED) {
            found.lockedUntil = Date.now() + LOCKOUT_MS;
            auditLog({ userId: found.id, action: "auth.lockout", severity: "warn",
              metadata: { ip: ipAddress } });
          } else {
            auditLog({ action: "auth.signin_failed", severity: "warn",
              metadata: { ip: ipAddress, attempt: found.failedAttempts } });
          }
          await dbSave(found);
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      if (found.lockedUntil && Date.now() < found.lockedUntil) {
        const mins = Math.ceil((found.lockedUntil - Date.now()) / 60_000);
        throw new TRPCError({ code: "FORBIDDEN", message: `الحساب مقفل. حاول بعد ${mins} دقيقة.` });
      }

      found.failedAttempts = 0;
      found.lockedUntil    = null;
      await dbSave(found);

      const sessionId   = randomBytes(16).toString("hex");
      const accessToken = signAccessToken(buildPayload(found, sessionId), 900);
      const rt          = issueRefreshTokenSync(found.id, sessionId, buildPayload(found, sessionId));
      const csrfToken   = issueCsrfTokenSync(sessionId);

      await cache.del(`user:${found.uid}`);
      auditLog({ userId: found.id, action: "auth.signin", severity: "info",
        metadata: { ip: ipAddress } });

      return { accessToken, refreshToken: rt.token, csrfToken, user: publicUser(found) };
    }),

  // ── REFRESH ────────────────────────────────────────────────────────────────
  refresh: publicQuery
    .input(z.object({ refreshToken: z.string().min(10).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const { ipAddress } = extractAuditContext(ctx.req);
      if (!await authLimiter.allow(`refresh:${ipAddress}`, 30, 60_000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
      }
      try {
        const rotated = rotateRefreshTokenSync(input.refreshToken);
        auditLog({ action: "auth.token_refresh", severity: "info", metadata: { ip: ipAddress } });
        return { accessToken: rotated.accessToken, refreshToken: rotated.refreshToken };
      } catch (err) {
        const msg = String(err);
        if (msg.includes("REUSE")) {
          auditLog({ action: "auth.token_reuse_detected", severity: "critical", metadata: { ip: ipAddress } });
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Refresh token invalid or expired" });
      }
    }),

  // ── ME ────────────────────────────────────────────────────────────────────
  me: protectedQuery
    .query(async ({ ctx }) => {
      const u = ctx.user as AuthUser;
      const cached = await cache.get<ReturnType<typeof publicUser>>(`user:${u.uid}`);
      if (cached) return cached;
      const found = await dbGetByUid(u.uid);
      if (!found) throw new TRPCError({ code: "NOT_FOUND" });
      const result = publicUser(found);
      await cache.set(`user:${u.uid}`, result, 300);
      return result;
    }),

  // ── SIGN OUT ──────────────────────────────────────────────────────────────
  signOut: protectedQuery
    .mutation(async ({ ctx }) => {
      const u = ctx.user as AuthUser;
      revokeJtiSync(u.jti);
      await cache.del(`user:${u.uid}`);
      auditLog({ userId: u.id, action: "auth.signout", severity: "info", metadata: { uid: u.uid } });
      return { success: true };
    }),

  // ── LOGOUT ALL DEVICES ────────────────────────────────────────────────────
  logoutAll: protectedQuery
    .mutation(async ({ ctx }) => {
      const u = ctx.user as AuthUser;
      revokeAllUserTokensSync(u.id);
      await cache.del(`user:${u.uid}`);
      auditLog({ userId: u.id, action: "auth.logout_all", severity: "warn", metadata: { uid: u.uid } });
      return { success: true };
    }),

  // ── CHANGE PASSWORD ───────────────────────────────────────────────────────
  changePassword: protectedQuery
    .input(z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword:     z.string().min(8).max(128)
        .refine(p => /[A-Z]/.test(p))
        .refine(p => /[0-9]/.test(p)),
    }))
    .mutation(async ({ input, ctx }) => {
      const u     = ctx.user as AuthUser;
      const found = await dbGetByUid(u.uid);
      if (!found) throw new TRPCError({ code: "NOT_FOUND" });
      if (!verifyPassword(input.currentPassword, found.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور الحالية غير صحيحة" });
      }
      found.passwordHash = hashPassword(input.newPassword);
      await dbSave(found);
      revokeAllUserTokensSync(u.id);
      await cache.del(`user:${u.uid}`);
      auditLog({ userId: u.id, action: "auth.logout_all", severity: "warn",
        metadata: { event: "password_changed" } });
      return { success: true };
    }),
});
