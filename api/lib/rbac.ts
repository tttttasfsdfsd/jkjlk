/**
 * Enterprise RBAC — Role-Based Access Control
 * Roles: super_admin > company_owner > admin > manager > analyst > viewer
 */
import { TRPCError } from "@trpc/server";
import type { AuthUser } from "../middleware";

// ==================== ROLE HIERARCHY ====================
export const ROLES = [
  "super_admin",
  "company_owner",
  "admin",
  "manager",
  "analyst",
  "viewer",
] as const;

export type Role = typeof ROLES[number];

// ==================== PERMISSIONS ====================
export const PERMISSIONS = {
  // Reports
  "reports:create":  ["company_owner","admin","manager","analyst"],
  "reports:read":    ["company_owner","admin","manager","analyst","viewer"],
  "reports:delete":  ["company_owner","admin"],
  "reports:export":  ["company_owner","admin","manager","analyst"],
  // Users
  "users:read":      ["company_owner","admin","manager"],
  "users:manage":    ["company_owner","admin"],
  "users:invite":    ["company_owner","admin"],
  // Billing
  "billing:read":    ["company_owner","admin"],
  "billing:manage":  ["company_owner"],
  // AI
  "ai:use":          ["company_owner","admin","manager","analyst"],
  // Uploads
  "uploads:create":  ["company_owner","admin","manager","analyst"],
  "uploads:read":    ["company_owner","admin","manager","analyst","viewer"],
  "uploads:delete":  ["company_owner","admin"],
  // Audit
  "audit:read":      ["company_owner","admin"],
  // Super admin only
  "platform:manage": ["super_admin"],
  "companies:manage":["super_admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

// ==================== ROLE HIERARCHY LEVELS ====================
const ROLE_LEVELS: Record<Role, number> = {
  super_admin:    100,
  company_owner:  80,
  admin:          60,
  manager:        40,
  analyst:        20,
  viewer:         10,
};

// ==================== PERMISSION CHECK ====================
export function hasPermission(userRole: Role, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission];
  // super_admin bypasses all permission checks
  if (userRole === "super_admin") return true;
  return (allowed as readonly string[]).includes(userRole);
}

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  if (userRole === "super_admin") return true;
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

// ==================== tRPC MIDDLEWARE BUILDERS ====================

export function requirePermission(permission: Permission) {
  return ({ ctx, next }: { ctx: { user?: AuthUser | null }; next: (arg?: any) => any }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const role = (ctx.user.role ?? "viewer") as Role;
    if (!hasPermission(role, permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permission required: ${permission}`,
      });
    }
    return next({ ctx });
  };
}

export function requireRole(requiredRole: Role) {
  return ({ ctx, next }: { ctx: { user?: AuthUser | null }; next: (arg?: any) => any }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const role = (ctx.user.role ?? "viewer") as Role;
    if (!hasRole(role, requiredRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Minimum role required: ${requiredRole}`,
      });
    }
    return next({ ctx });
  };
}

// ==================== TENANT ISOLATION GUARD ====================
/**
 * Enforces that the requesting user belongs to the same companyId
 * as the resource being accessed. Call this before any DB query
 * that touches company-scoped data.
 */
export function assertTenantAccess(
  user: AuthUser,
  resourceCompanyId: number | null | undefined
): void {
  if (!resourceCompanyId) return; // global resource
  if (user.role === "super_admin") return; // bypass for super_admin
  if (user.companyId !== resourceCompanyId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied: cross-tenant data access prevented",
    });
  }
}

// ==================== SEED DATA ====================
export const SYSTEM_ROLES: Array<{ name: Role; description: string }> = [
  { name: "super_admin",    description: "Full platform access — Anthropic/EEXA operators only" },
  { name: "company_owner",  description: "Full access to own company — billing, users, reports" },
  { name: "admin",          description: "Manage users and reports within company" },
  { name: "manager",        description: "Create and view reports, manage analysts" },
  { name: "analyst",        description: "Create and view reports" },
  { name: "viewer",         description: "Read-only access to reports" },
];

export const SYSTEM_PERMISSIONS: Array<{ resource: string; action: string }> = [
  { resource:"reports",  action:"create"  },
  { resource:"reports",  action:"read"    },
  { resource:"reports",  action:"delete"  },
  { resource:"reports",  action:"export"  },
  { resource:"users",    action:"read"    },
  { resource:"users",    action:"manage"  },
  { resource:"users",    action:"invite"  },
  { resource:"billing",  action:"read"    },
  { resource:"billing",  action:"manage"  },
  { resource:"ai",       action:"use"     },
  { resource:"uploads",  action:"create"  },
  { resource:"uploads",  action:"read"    },
  { resource:"uploads",  action:"delete"  },
  { resource:"audit",    action:"read"    },
  { resource:"platform", action:"manage"  },
  { resource:"companies",action:"manage"  },
];
