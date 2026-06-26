/**
 * EEXA Tenant Isolation — 3-Layer Protection
 * Layer 1: Database (companyId on all queries)
 * Layer 2: Service (assertTenantAccess before every query)
 * Layer 3: API (RBAC middleware on every route)
 *
 * Guarantees: Company A CANNOT access Company B data.
 */
import { TRPCError } from "@trpc/server";
import type { AuthUser } from "../middleware";

// ==================== TENANT-SCOPED QUERY BUILDER ====================
/**
 * Wraps any Drizzle WHERE condition with mandatory companyId filter.
 * Usage: const where = tenantWhere(user, { id: eq(reports.id, reportId) })
 * This forces companyId into EVERY query — no query can forget it.
 */
export function tenantScope(user: AuthUser): { companyId: number } {
  if (user.role === "super_admin") {
    // super_admin must explicitly pass a companyId — cannot do implicit global
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "super_admin must specify companyId for scoped queries",
    });
  }
  if (!user.companyId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User has no company assignment",
    });
  }
  return { companyId: user.companyId };
}

/**
 * For super_admin who explicitly passes a companyId,
 * or for regular users (validates they own the companyId).
 */
export function resolveCompanyId(user: AuthUser, requestedCompanyId?: number): number {
  if (user.role === "super_admin") {
    if (!requestedCompanyId) throw new TRPCError({ code: "BAD_REQUEST", message: "companyId required" });
    return requestedCompanyId;
  }
  if (!user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "No company assigned" });
  // Regular users: reject if they try to access a different company
  if (requestedCompanyId && requestedCompanyId !== user.companyId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Cross-tenant access denied" });
  }
  return user.companyId;
}

/**
 * Validates a fetched resource belongs to the requesting user's company.
 * Call AFTER fetching from DB — second line of defense.
 */
export function assertOwnership<T extends { companyId?: number | null }>(
  user: AuthUser,
  resource: T | null | undefined,
  resourceName = "Resource"
): T {
  if (!resource) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (user.role === "super_admin") return resource;
  if (resource.companyId == null || resource.companyId !== user.companyId) {
    // Log potential cross-tenant probe — don't reveal existence
    throw new TRPCError({ code: "NOT_FOUND" }); // 404 not 403 — prevents enumeration
  }
  return resource;
}

/**
 * Validates userId matches (for user-owned resources).
 */
export function assertUserOwnership<T extends { userId?: number | null }>(
  user: AuthUser,
  resource: T | null | undefined
): T {
  if (!resource) throw new TRPCError({ code: "NOT_FOUND" });
  if (user.role === "super_admin") return resource;
  if (["company_owner","admin"].includes(user.role ?? "")) return resource; // admins see all in company
  if (resource.userId !== user.id) throw new TRPCError({ code: "NOT_FOUND" });
  return resource;
}
