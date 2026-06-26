import "dotenv/config";

// ==================== ENVIRONMENT VALIDATION ====================
// All required variables are validated at startup.
// Missing production secrets throw immediately — no silent fallbacks.

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`FATAL: Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function optional(name: string, defaultVal = ""): string {
  return process.env[name] ?? defaultVal;
}

function requiredInProd(name: string, devDefault: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`FATAL: Missing required production variable: ${name}`);
    }
    return devDefault;
  }
  return value;
}

export const env = {
  // App identity
  appId:        optional("APP_ID", "eexa-platform"),
  nodeEnv:      optional("NODE_ENV", "development"),
  isProduction: process.env.NODE_ENV === "production",

  // Security — NEVER expose these to the client
  jwtSecret:    requiredInProd("JWT_SECRET", "dev-jwt-secret-change-in-prod-min-32chars"),
  // jwtRefreshSecret and sessionSecret removed — P2-13 dead code.
  // JWT signing uses jwtSecret only (HS256). Sessions are stateless JWTs.

  // Database
  databaseUrl:  optional("DATABASE_URL"),

  // AI
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
  openaiApiKey:    optional("OPENAI_API_KEY"),

  // Billing
  stripeSecretKey:    optional("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: optional("STRIPE_WEBHOOK_SECRET"),
  moyasarSecretKey:   optional("MOYASAR_SECRET_KEY"),

  // QuickBooks OAuth
  qbClientId:      optional("QB_CLIENT_ID"),
  qbClientSecret:  optional("QB_CLIENT_SECRET"),
  qbRedirectUri:   optional("QB_REDIRECT_URI", "http://localhost:3001/api/quickbooks/callback"),

  // CORS
  allowedOrigins: optional("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(","),

  // Rate limiting
  rateLimitWindowMs:  parseInt(optional("RATE_LIMIT_WINDOW_MS", "900000")), // 15 min
  get rateLimitMaxRequests() { return parseInt(process.env.RATE_LIMIT_MAX ?? "100"); },
  get analyzeRateLimitMax() { return parseInt(process.env.ANALYZE_RATE_LIMIT_MAX ?? "10"); },

  // File upload
  maxFileSizeMb: parseInt(optional("MAX_FILE_SIZE_MB", "25")),

  // Redis — P2-15: consolidated from envExtra
  redisUrl: optional("REDIS_URL"),
  get hasRedis() { return !!process.env.REDIS_URL; },
} as const;

// Log sanitized config on startup (never log secrets)
if (!env.isProduction) {
  console.log("[env] Config loaded:", {
    nodeEnv: env.nodeEnv,
    hasAnthropicKey: !!env.anthropicApiKey,
    hasStripe: !!env.stripeSecretKey,
    hasMoyasar: !!env.moyasarSecretKey,
    hasDatabase: !!env.databaseUrl,
    maxFileSizeMb: env.maxFileSizeMb,
  });
}

// envExtra removed — merged into env above (P2-15)
