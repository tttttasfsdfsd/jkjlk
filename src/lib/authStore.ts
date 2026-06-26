/**
 * EEXA Client Auth Store — v5 Hardened
 *
 * ARCHITECTURE:
 *   All authentication is server-side (api/routers/auth.ts via tRPC).
 *   This module manages ONLY client-side state derived from server responses.
 *
 * SECURITY DECISIONS:
 *   - Passwords NEVER touch this file. Zero client-side hashing.
 *   - No user registry in localStorage. Users live in the server DB.
 *   - JWT access token: sessionStorage only (cleared on tab close).
 *   - Refresh token: httpOnly cookie (set by server — NOT accessible here).
 *   - User profile: sessionStorage only — no PII in localStorage.
 *   - Report cache: localStorage keyed by server-issued userId (never email).
 *   - All plan/quota enforcement is server-side; client state is display-only.
 */

export type UserRole = 'super_admin' | 'company_owner' | 'admin' | 'manager' | 'analyst' | 'sme_owner' | 'accountant' | 'viewer';
export type UserPlan = 'free' | 'professional' | 'business' | 'enterprise';

export interface User {
  id:               number;
  uid:              string;
  email:            string;
  name:             string;
  role:             UserRole;
  plan:             UserPlan;
  reportsUsed:      number;
  reportsLimit:     number;
  reportsResetDate: string;
  createdAt:        string;
  emailVerified:    boolean;
  lastLoginAt:      string;
  companyId?:       number | null;
}

// Storage keys — never store sensitive data under these keys
const SESSION_TOKEN_KEY = 'eexa_at';       // access token (sessionStorage only)
const USER_KEY          = 'eexa_user';     // user profile  (sessionStorage only)
const REPORTS_KEY       = 'eexa_rpts';    // report cache  (localStorage, keyed by uid)

// ==================== TOKEN MANAGEMENT ====================
// Access token stored in sessionStorage — cleared when tab/browser closes
// Refresh token is an httpOnly cookie managed entirely by the server

export function getAccessToken(): string | null {
  try { return sessionStorage.getItem(SESSION_TOKEN_KEY); }
  catch { return null; }
}

export function setAccessToken(token: string): void {
  try { sessionStorage.setItem(SESSION_TOKEN_KEY, token); }
  catch { /* private browsing */ }
}

export function clearAccessToken(): void {
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch { /* ignore */ }
}

// ==================== USER PROFILE ====================
export function getCurrentUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch { return null; }
}

export function setCurrentUser(user: User): void {
  try {
    // Never persist to localStorage — sessionStorage only
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* private browsing */ }
}

export function clearCurrentUser(): void {
  try {
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch { /* ignore */ }
}

// ==================== INPUT VALIDATION (display-only) ====================
// These are UI validators only — server enforces all rules independently

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8)   return { valid: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'يجب أن تحتوي على حرف كبير' };
  if (!/[0-9]/.test(password)) return { valid: false, error: 'يجب أن تحتوي على رقم' };
  return { valid: true };
}

// ==================== SESSION HELPERS ====================
export function isAuthenticated(): boolean {
  return !!getAccessToken() && !!getCurrentUser();
}

export function signOut(): void {
  clearCurrentUser();
  clearAccessToken();
  // Server-side: call auth.signOut tRPC mutation to revoke JWT JTI + clear httpOnly cookie
}

// ==================== ROLE CHECKS (display-only) ====================
// Server enforces RBAC independently. These are for UI rendering only.
export function hasPermission(
  user: User | null,
  action: 'analyze' | 'export' | 'admin' | 'delete'
): boolean {
  if (!user) return false;
  const map: Partial<Record<UserRole, string[]>> = {
    super_admin:   ['analyze','export','admin','delete'],
    company_owner: ['analyze','export','admin','delete'],
    admin:         ['analyze','export','admin','delete'],
    manager:       ['analyze','export'],
    analyst:       ['analyze','export'],
    sme_owner:     ['analyze','export','delete'],
    accountant:    ['analyze','export'],
    viewer:        [],
  };
  return map[user.role]?.includes(action) ?? false;
}

// ==================== REPORT CACHE (localStorage, display only) ====================
// Reports are canonical on the server. This is a local display cache only.

export interface SavedReport {
  id:          string;
  companyName: string;
  date:        string;
  score:       number;
  revenue:     number;
  netProfit:   number;
  netMargin:   number;
  data:        Record<string, unknown>;
  userId?:     number;
}

function reportKey(user: User | null): string {
  // Key by server-issued numeric ID (not email) to avoid PII in localStorage keys
  return user?.uid ? `${REPORTS_KEY}_${user.uid}` : `${REPORTS_KEY}_guest`;
}

export function saveReport(report: Omit<SavedReport, 'id' | 'date'>): SavedReport {
  const user = getCurrentUser();
  const saved: SavedReport = {
    id:     `rpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    date:   new Date().toISOString(),
    userId: user?.id,
    ...report,
  };
  const all     = getSavedReports();
  const updated = [saved, ...all].slice(0, 50);
  try {
    localStorage.setItem(reportKey(user), JSON.stringify(updated));
  } catch { /* storage full */ }
  return saved;
}

export function getSavedReports(): SavedReport[] {
  try {
    return JSON.parse(localStorage.getItem(reportKey(getCurrentUser())) || '[]');
  } catch { return []; }
}

export function deleteReport(id: string): void {
  const user = getCurrentUser();
  const key  = reportKey(user);
  try {
    const all = getSavedReports().filter(r => r.id !== id);
    localStorage.setItem(key, JSON.stringify(all));
  } catch { /* ignore */ }
}

// ==================== PLAN LIMITS (display-only, server enforces) ====================
const PLAN_LIMITS: Record<UserPlan, number> = {
  free: 3, professional: 999, business: 9999, enterprise: 999999,
};

export function getReportsRemaining(user: User | null): number {
  if (!user) return 0;
  return Math.max(0, user.reportsLimit - user.reportsUsed);
}

/**
 * Client-side quota check for UI feedback only.
 * Server ALWAYS re-validates before allowing a report to be generated.
 */
export function canCreateReport(user: User | null): boolean {
  if (!user) return false;
  return user.reportsUsed < user.reportsLimit;
}

// ==================== TRPC-BACKED AUTH FUNCTIONS ====================
// These are called by AuthModal and PricingModal.
// They talk to the server via the tRPC client in the background.
// For UI synchrony they also update sessionStorage state immediately.

/**
 * Signs in the user via tRPC (server-side).
 * Returns the user on success, throws with Arabic message on failure.
 * NOTE: AuthModal calls this; actual HTTP request goes to api/routers/auth.ts
 */
export async function signIn(email: string, password: string): Promise<User> {
  try {
    // Validate client-side first for fast feedback
    if (!validateEmail(email)) throw new Error('البريد الإلكتروني غير صحيح');
    if (!password || password.length < 6) throw new Error('كلمة المرور قصيرة جداً');

    // Call server — tRPC v11 httpBatchLink wire format: { "0": { json: {...} } }
    const res = await fetch('/api/trpc/auth.signIn', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ "0": { json: { email: email.trim().toLowerCase(), password } } }),
    });

    const raw = await res.json();
    // tRPC v11 batch response is an array: [{ result: { data: { json: ... } } }]
    const batchItem = Array.isArray(raw) ? raw[0] : raw;
    const data = batchItem?.result?.data?.json ?? batchItem?.result?.data;

    if (!res.ok || !data?.accessToken) {
      const msg = raw?.error?.message || raw?.error?.json?.message || 'فشل تسجيل الدخول';
      throw new Error(msg);
    }

    setAccessToken(data.accessToken);
    const user: User = {
      id:               data.user.id,
      uid:              data.user.uid,
      email:            data.user.email,
      name:             data.user.name,
      role:             data.user.role,
      plan:             data.user.plan,
      reportsUsed:      data.user.reportsUsed   ?? 0,
      reportsLimit:     data.user.reportsLimit  ?? 3,
      reportsResetDate: '',
      createdAt:        new Date().toISOString(),
      emailVerified:    data.user.emailVerified ?? false,
      lastLoginAt:      new Date().toISOString(),
      companyId:        data.user.companyId ?? null,
    };
    setCurrentUser(user);
    return user;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error('فشل تسجيل الدخول');
  }
}

/**
 * Signs up a new user via tRPC (server-side).
 */
export async function signUp(email: string, name: string, password: string): Promise<User> {
  try {
    const emailCheck = validateEmail(email);
    if (!emailCheck) throw new Error('البريد الإلكتروني غير صحيح');
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) throw new Error(pwCheck.error ?? 'كلمة المرور ضعيفة');
    if (!name || name.trim().length < 2) throw new Error('يرجى إدخال اسمك');

    const res = await fetch('/api/trpc/auth.signUp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ "0": { json: { email: email.trim().toLowerCase(), name: name.trim(), password } } }),
    });

    const raw = await res.json();
    // tRPC v11 batch response is an array
    const batchItem = Array.isArray(raw) ? raw[0] : raw;
    const data = batchItem?.result?.data?.json ?? batchItem?.result?.data;

    if (!res.ok || !data?.accessToken) {
      const msg = raw?.error?.message || raw?.error?.json?.message || 'فشل إنشاء الحساب';
      throw new Error(msg);
    }

    setAccessToken(data.accessToken);
    const user: User = {
      id:               data.user.id,
      uid:              data.user.uid,
      email:            data.user.email,
      name:             data.user.name,
      role:             data.user.role,
      plan:             data.user.plan,
      reportsUsed:      data.user.reportsUsed   ?? 0,
      reportsLimit:     data.user.reportsLimit  ?? 3,
      reportsResetDate: '',
      createdAt:        new Date().toISOString(),
      emailVerified:    false,
      lastLoginAt:      new Date().toISOString(),
      companyId:        data.user.companyId ?? null,
    };
    setCurrentUser(user);
    return user;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error('فشل إنشاء الحساب');
  }
}

/**
 * Upgrades the current user's plan via real Stripe Checkout.
 * Creates a server-side Stripe Checkout Session and redirects the browser.
 * Plan in database is updated by the webhook handler after payment completes.
 */
export async function upgradePlan(planId: 'starter' | 'professional'): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');
  const token = getAccessToken();
  if (!token) throw new Error('رمز المصادقة مفقود');

  // Map UI plan IDs to billing plan IDs
  const BILLING_PLAN: Record<string, string> = {
    starter:      'professional',
    professional: 'business',
  };
  const billingPlan = BILLING_PLAN[planId] ?? 'professional';

  // Request a Stripe Checkout Session from the server
  const res = await fetch(`/api/billing/checkout?plan=${encodeURIComponent(billingPlan)}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'فشل إنشاء جلسة الدفع');
  }

  const { url } = await res.json() as { url: string };
  if (!url) throw new Error('لم يتم الحصول على رابط الدفع');

  // Redirect to Stripe hosted checkout page
  window.location.href = url;
}

// Alias for PricingModal which uses `upgradeplan` (lowercase)
export const upgradeplan = upgradePlan;

/**
 * Checks if the current user can create a report and increments the counter.
 * Returns { allowed: true } if allowed, { allowed: false, user? } otherwise.
 */
export function consumeReport(): { allowed: boolean; user: User | null } {
  const user = getCurrentUser();

  // Not logged in → redirect to signup
  if (!user) return { allowed: false, user: null };

  // Over limit → show pricing
  if (user.reportsUsed >= user.reportsLimit) {
    return { allowed: false, user };
  }

  // Increment counter
  const updated: User = { ...user, reportsUsed: user.reportsUsed + 1 };
  setCurrentUser(updated);
  return { allowed: true, user: updated };
}
