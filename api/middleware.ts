/**
 * EEXA API Middleware — tRPC procedures with full RBAC
 * Roles: super_admin | company_owner | admin | manager | analyst | viewer
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { verifyAccessToken, type JwtPayload } from "./lib/tokenService";
import { hasPermission, hasRole, type Role, type Permission } from "./lib/rbac";
import { auditLog, extractAuditContext } from "./lib/auditLogger";
import { metrics, startTimer } from "./lib/observability";

// ==================== AUTH USER ====================
export interface AuthUser {
  id:           number;
  uid:          string;
  email:        string;
  role:         Role;
  plan:         "free" | "professional" | "business" | "enterprise";
  companyId:    number | null;
  reportsUsed:  number;
  reportsLimit: number;
  sessionId:    string;
  jti:          string;
}

// Re-export for backwards compatibility
export { signAccessToken as signJWT, verifyAccessToken as verifyJWT } from "./lib/tokenService";

// ==================== tRPC INIT ====================
const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const createRouter = t.router;

// ==================== HELPER ====================
function extractToken(ctx: TrpcContext): string | null {
  const auth = ctx.req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return null;
}

function getUser(ctx: TrpcContext): AuthUser | null {
  const token = extractToken(ctx);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  return {
    id:           payload.id,
    uid:          payload.uid,
    email:        payload.email,
    role:         (payload.role as Role) ?? "viewer",
    plan:         (payload.plan as AuthUser["plan"]) ?? "free",
    companyId:    payload.companyId ?? null,
    reportsUsed:  payload.reportsUsed  ?? 0,
    reportsLimit: payload.reportsLimit ?? 3,
    sessionId:    payload.sessionId,
    jti:          payload.jti,
  };
}

// ==================== INSTRUMENTATION MIDDLEWARE ====================
const instrumentedProcedure = t.procedure.use(async ({ ctx, path, next }) => {
  const timer = startTimer();
  try {
    const result = await next({ ctx });
    metrics.observe("trpc_latency_ms", timer());
    metrics.inc("trpc_requests", { path, status: "ok" });
    return result;
  } catch (err) {
    metrics.inc("trpc_requests", { path, status: "error" });
    throw err;
  }
});

// ==================== PUBLIC — no auth ====================
export const publicQuery = instrumentedProcedure;

// ==================== PROTECTED — valid JWT required ====================
export const protectedQuery = instrumentedProcedure.use(async ({ ctx, next }) => {
  const user = getUser(ctx);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  return next({ ctx: { ...ctx, user } });
});

// ==================== REQUIRE PERMISSION ====================
export function withPermission(permission: Permission) {
  return protectedQuery.use(async ({ ctx, next }) => {
    // P2-14: ctx.user typed via protectedQuery's next({ ctx: { ...ctx, user } })
    const user = (ctx as { user: AuthUser }).user;
    if (!hasPermission(user.role, permission)) {
      const { ipAddress } = extractAuditContext(ctx.req);
      auditLog({
        userId:    user.id,
        companyId: user.companyId ?? undefined,
        action:    "security.rbac_violation",
        severity:  "critical",
        metadata:  { permission, role: user.role, ip: ipAddress },
      });
      throw new TRPCError({ code: "FORBIDDEN", message: `Permission required: ${permission}` });
    }
    return next({ ctx });
  });
}

// ==================== REQUIRE ROLE ====================
export function withRole(requiredRole: Role) {
  return protectedQuery.use(async ({ ctx, next }) => {
    const user = (ctx as { user: AuthUser }).user;
    if (!hasRole(user.role, requiredRole)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Role required: ${requiredRole}` });
    }
    return next({ ctx });
  });
}

// ==================== SHORTCUTS ====================
export const adminQuery    = withRole("admin");
export const analystQuery  = withPermission("reports:create");
export const billingQuery  = withPermission("billing:read");
export const superAdminQuery = withRole("super_admin");
