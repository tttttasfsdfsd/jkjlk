import {
  mysqlTable, serial, varchar, text, timestamp, int, boolean,
  mysqlEnum, bigint, index, uniqueIndex, decimal, tinyint,
} from "drizzle-orm/mysql-core";

// ==================== USERS ====================
export const users = mysqlTable("users", {
  id:             serial("id").primaryKey(),
  uid:            varchar("uid",           { length: 64  }).notNull(),
  email:          varchar("email",         { length: 255 }).notNull(),
  name:           varchar("name",          { length: 255 }).notNull(),
  passwordHash:   varchar("password_hash", { length: 512 }).notNull(),
  plan:           mysqlEnum("plan", ["free","professional","business","enterprise"]).notNull().default("free"),
  reportsUsed:    int("reports_used").notNull().default(0),
  reportsLimit:   int("reports_limit").notNull().default(3),
  reportsResetAt: timestamp("reports_reset_at").notNull(),
  emailVerified:  boolean("email_verified").notNull().default(false),
  companyId:      bigint("company_id",     { mode:"number", unsigned:true }),
  lastLoginAt:    timestamp("last_login_at"),
  mfaSecret:      varchar("mfa_secret",    { length: 64  }),
  mfaEnabled:     boolean("mfa_enabled").notNull().default(false),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  deletedAt:      timestamp("deleted_at"),
}, (t) => ({
  emailIdx:   uniqueIndex("users_email_idx").on(t.email),
  uidIdx:     uniqueIndex("users_uid_idx").on(t.uid),
  companyIdx: index("users_company_idx").on(t.companyId),
}));

// ==================== COMPANIES ====================
export const companies = mysqlTable("companies", {
  id:        serial("id").primaryKey(),
  name:      varchar("name",     { length: 255 }).notNull(),
  industry:  varchar("industry", { length: 100 }),
  country:   varchar("country",  { length: 10  }).notNull().default("SA"),
  ownerId:   bigint("owner_id",  { mode:"number", unsigned:true }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  deletedAt: timestamp("deleted_at"),
});

// ==================== RBAC — ROLES ====================
export const roles = mysqlTable("roles", {
  id:          serial("id").primaryKey(),
  name:        varchar("name",        { length: 50  }).notNull(), // super_admin | company_owner | admin | manager | analyst | viewer
  description: varchar("description", { length: 255 }),
  isSystem:    boolean("is_system").notNull().default(false), // system roles cannot be deleted
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  nameIdx: uniqueIndex("roles_name_idx").on(t.name),
}));

// ==================== RBAC — PERMISSIONS ====================
export const permissions = mysqlTable("permissions", {
  id:       serial("id").primaryKey(),
  resource: varchar("resource", { length: 100 }).notNull(), // reports | users | billing | ai | uploads | audit
  action:   varchar("action",   { length: 50  }).notNull(), // create | read | update | delete | export | manage
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  resActIdx: uniqueIndex("perm_res_act_idx").on(t.resource, t.action),
}));

// ==================== RBAC — ROLE_PERMISSIONS ====================
export const rolePermissions = mysqlTable("role_permissions", {
  id:           serial("id").primaryKey(),
  roleId:       bigint("role_id",       { mode:"number", unsigned:true }).notNull(),
  permissionId: bigint("permission_id", { mode:"number", unsigned:true }).notNull(),
}, (t) => ({
  rpIdx: uniqueIndex("rp_role_perm_idx").on(t.roleId, t.permissionId),
  roleIdx: index("rp_role_idx").on(t.roleId),
}));

// ==================== RBAC — USER_ROLES ====================
export const userRoles = mysqlTable("user_roles", {
  id:        serial("id").primaryKey(),
  userId:    bigint("user_id",    { mode:"number", unsigned:true }).notNull(),
  roleId:    bigint("role_id",    { mode:"number", unsigned:true }).notNull(),
  companyId: bigint("company_id", { mode:"number", unsigned:true }), // null = global (super_admin)
  grantedBy: bigint("granted_by", { mode:"number", unsigned:true }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  urIdx:      uniqueIndex("ur_user_role_co_idx").on(t.userId, t.roleId, t.companyId),
  userIdx:    index("ur_user_idx").on(t.userId),
  companyIdx: index("ur_company_idx").on(t.companyId),
}));

// ==================== SESSIONS ====================
export const sessions = mysqlTable("sessions", {
  id:           serial("id").primaryKey(),
  jti:          varchar("jti",       { length: 64  }).notNull(), // JWT ID for revocation
  userId:       bigint("user_id",    { mode:"number", unsigned:true }).notNull(),
  companyId:    bigint("company_id", { mode:"number", unsigned:true }),
  deviceName:   varchar("device_name",   { length: 200 }),
  userAgent:    varchar("user_agent",    { length: 500 }),
  ipAddress:    varchar("ip_address",    { length: 45  }),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
  expiresAt:    timestamp("expires_at").notNull(),
  revokedAt:    timestamp("revoked_at"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  jtiIdx:  uniqueIndex("sessions_jti_idx").on(t.jti),
  userIdx: index("sessions_user_idx").on(t.userId),
}));

// ==================== REFRESH TOKENS ====================
export const refreshTokens = mysqlTable("refresh_tokens", {
  id:           serial("id").primaryKey(),
  token:        varchar("token",     { length: 128 }).notNull(), // SHA-256 hash of actual token
  sessionId:    bigint("session_id", { mode:"number", unsigned:true }).notNull(),
  userId:       bigint("user_id",    { mode:"number", unsigned:true }).notNull(),
  family:       varchar("family",    { length: 64  }).notNull(), // rotation family — detect reuse
  rotationCount: int("rotation_count").notNull().default(0),
  usedAt:       timestamp("used_at"),
  expiresAt:    timestamp("expires_at").notNull(),
  revokedAt:    timestamp("revoked_at"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tokenIdx:   uniqueIndex("rt_token_idx").on(t.token),
  sessionIdx: index("rt_session_idx").on(t.sessionId),
  userIdx:    index("rt_user_idx").on(t.userId),
  familyIdx:  index("rt_family_idx").on(t.family),
}));

// ==================== CSRF TOKENS ====================
export const csrfTokens = mysqlTable("csrf_tokens", {
  id:        serial("id").primaryKey(),
  token:     varchar("token",   { length: 128 }).notNull(),
  sessionId: bigint("session_id", { mode:"number", unsigned:true }).notNull(),
  usedAt:    timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tokenIdx: uniqueIndex("csrf_token_idx").on(t.token),
  sessIdx:  index("csrf_sess_idx").on(t.sessionId),
}));

// ==================== REPORTS ====================
export const reports = mysqlTable("reports", {
  id:           serial("id").primaryKey(),
  uid:          varchar("uid",          { length: 64  }).notNull(),
  userId:       bigint("user_id",       { mode:"number", unsigned:true }).notNull(),
  companyId:    bigint("company_id",    { mode:"number", unsigned:true }).notNull(), // MANDATORY
  companyName:  varchar("company_name", { length: 255 }).notNull(),
  score:        int("score").notNull().default(0),
  revenue:      decimal("revenue",    { precision:20, scale:2 }),
  netProfit:    decimal("net_profit", { precision:20, scale:2 }),
  netMargin:    decimal("net_margin", { precision:8,  scale:4 }),
  dataSnapshot: text("data_snapshot"), // AES-256-GCM encrypted JSON
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  deletedAt:    timestamp("deleted_at"),
}, (t) => ({
  userIdx:    index("reports_user_idx").on(t.userId),
  companyIdx: index("reports_company_idx").on(t.companyId),
  uidIdx:     uniqueIndex("reports_uid_idx").on(t.uid),
}));

// ==================== UPLOADS ====================
export const uploads = mysqlTable("uploads", {
  id:           serial("id").primaryKey(),
  uid:          varchar("uid",       { length: 64  }).notNull(),
  userId:       bigint("user_id",    { mode:"number", unsigned:true }).notNull(),
  companyId:    bigint("company_id", { mode:"number", unsigned:true }).notNull(), // MANDATORY
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType:     varchar("mime_type",     { length: 100 }).notNull(),
  sizeBytes:    bigint("size_bytes",  { mode:"number" }).notNull(),
  storageKey:   varchar("storage_key",   { length: 500 }).notNull(),
  scanStatus:   mysqlEnum("scan_status", ["pending","clean","infected","failed"]).notNull().default("pending"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  deletedAt:    timestamp("deleted_at"),
}, (t) => ({
  uidIdx:     uniqueIndex("uploads_uid_idx").on(t.uid),
  companyIdx: index("uploads_company_idx").on(t.companyId),
}));

// ==================== AUDIT LOGS (immutable) ====================
export const auditLogs = mysqlTable("audit_logs", {
  id:         serial("id").primaryKey(),
  userId:     bigint("user_id",    { mode:"number", unsigned:true }),
  companyId:  bigint("company_id", { mode:"number", unsigned:true }),
  action:     varchar("action",    { length: 100 }).notNull(),
  resource:   varchar("resource",  { length: 100 }),
  resourceId: varchar("resource_id", { length: 64 }),
  ipAddress:  varchar("ip_address",  { length: 45  }),
  userAgent:  varchar("user_agent",  { length: 500 }),
  severity:   mysqlEnum("severity",  ["info","warn","critical"]).notNull().default("info"),
  metadata:   text("metadata"), // sanitized JSON, never financial data
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx:    index("audit_user_idx").on(t.userId),
  companyIdx: index("audit_company_idx").on(t.companyId),
  actionIdx:  index("audit_action_idx").on(t.action),
  tsIdx:      index("audit_ts_idx").on(t.createdAt),
  severityIdx:index("audit_severity_idx").on(t.severity),
}));

// ==================== SUBSCRIPTIONS ====================
export const subscriptions = mysqlTable("subscriptions", {
  id:                 serial("id").primaryKey(),
  userId:             bigint("user_id",    { mode:"number", unsigned:true }).notNull(),
  companyId:          bigint("company_id", { mode:"number", unsigned:true }),
  plan:               mysqlEnum("plan",   ["free","professional","business","enterprise"]).notNull(),
  status:             mysqlEnum("status", ["active","cancelled","past_due","trialing","incomplete"]).notNull(),
  stripeSubId:        varchar("stripe_sub_id",  { length: 255 }),
  stripeCustomerId:   varchar("stripe_customer_id", { length: 255 }),
  moyasarSubId:       varchar("moyasar_sub_id", { length: 255 }),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd:   timestamp("current_period_end"),
  cancelledAt:        timestamp("cancelled_at"),
  trialEndsAt:        timestamp("trial_ends_at"),
  createdAt:          timestamp("created_at").notNull().defaultNow(),
  updatedAt:          timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  userIdx:   index("subs_user_idx").on(t.userId),
  stripeIdx: index("subs_stripe_idx").on(t.stripeSubId),
}));

// ==================== WEBHOOK EVENTS (idempotency) ====================
export const webhookEvents = mysqlTable("webhook_events", {
  id:          serial("id").primaryKey(),
  provider:    mysqlEnum("provider", ["stripe","moyasar"]).notNull(),
  eventId:     varchar("event_id",   { length: 255 }).notNull(), // stripe event id
  eventType:   varchar("event_type", { length: 100 }).notNull(),
  processedAt: timestamp("processed_at"),
  status:      mysqlEnum("status", ["pending","processed","failed"]).notNull().default("pending"),
  payload:     text("payload"), // raw JSON, for replay
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  eventIdx: uniqueIndex("webhook_event_idx").on(t.provider, t.eventId),
}));

// ==================== AI AUDIT LOGS ====================
export const aiAuditLogs = mysqlTable("ai_audit_logs", {
  id:              serial("id").primaryKey(),
  userId:          bigint("user_id",    { mode:"number", unsigned:true }).notNull(),
  companyId:       bigint("company_id", { mode:"number", unsigned:true }).notNull(),
  sessionId:       varchar("session_id", { length: 64 }),
  promptTokens:    int("prompt_tokens"),
  completionTokens:int("completion_tokens"),
  model:           varchar("model", { length: 100 }),
  injectionDetected: boolean("injection_detected").notNull().default(false),
  groundingPassed: boolean("grounding_passed").notNull().default(true),
  latencyMs:       int("latency_ms"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx:    index("ai_audit_user_idx").on(t.userId),
  companyIdx: index("ai_audit_company_idx").on(t.companyId),
  tsIdx:      index("ai_audit_ts_idx").on(t.createdAt),
}));

// ==================== PLAN LIMITS (P6-33) ====================
// Enforced in every tRPC middleware via checkPlanLimit()
export const planLimits = mysqlTable("plan_limits", {
  id:             serial("id").primaryKey(),
  planName:       varchar("plan_name",       { length: 50 }).notNull().unique(),
  maxReports:     int("max_reports").notNull().default(3),
  maxAiRequests:  int("max_ai_requests").notNull().default(10),
  maxStorageMb:   int("max_storage_mb").notNull().default(50),
  maxFileSize:    int("max_file_size_mb").notNull().default(10),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Default plan limits seed data (applied on first migration)
export const DEFAULT_PLAN_LIMITS = [
  { planName: "free",         maxReports:   3, maxAiRequests:   10, maxStorageMb:    50, maxFileSize:  10 },
  { planName: "professional", maxReports:  30, maxAiRequests:  200, maxStorageMb:   500, maxFileSize:  50 },
  { planName: "business",     maxReports: 100, maxAiRequests: 1000, maxStorageMb:  5000, maxFileSize: 100 },
  { planName: "enterprise",   maxReports: 999, maxAiRequests: 9999, maxStorageMb: 50000, maxFileSize: 500 },
] as const;
