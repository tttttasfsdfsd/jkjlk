# EEXA Platform v4 — Security Guide

## Authentication Architecture

### Current State (v4 Client-Auth)
- Passwords hashed with PBKDF2 (100,000 iterations, SHA-256) via Web Crypto API
- No plaintext or base64 passwords stored (was critical vulnerability in v2)
- Session scoped to sessionStorage (cleared on browser close)
- Constant-time password comparison to prevent timing attacks
- User enumeration prevention (always runs hash even for missing users)

### Production Upgrade Required
Before commercial launch, implement server-side JWT auth:
```
POST /api/auth/register    → creates user in DB, returns JWT + refresh token
POST /api/auth/login       → verifies bcrypt hash from DB, returns JWT + refresh token
POST /api/auth/refresh     → validates refresh token, issues new JWT
POST /api/auth/logout      → revokes refresh token in DB
GET  /api/auth/me          → returns current user from JWT
```

JWT configuration:
- Access token: 15-minute expiry (HS256, env.jwtSecret)
- Refresh token: 30-day expiry, stored in HttpOnly Secure cookie
- Token rotation on every refresh
- Refresh token stored hashed in sessions table

## Security Headers (Implemented)
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Content-Security-Policy (configured in boot.ts)

## Rate Limiting (Implemented)
- Global: 100 requests per 15 minutes per IP
- /api/analyze: 10 requests per 15 minutes per IP
- Production: Replace in-memory map with Redis for multi-instance support

## File Upload Security (Implemented)
- Extension whitelist: xlsx, xls, xlsm, csv, pdf only
- Magic bytes (file signature) validation
- 25MB file size limit
- Zero-byte file rejection
- Blocked extensions: exe, bat, php, js, sh, and 20+ others

## Data Isolation
- Every report/record tagged with userId
- Query filters always include userId (multi-tenant isolation)
- Financial data never logged
- Company data isolated by companyId

## CSRF Protection
- CORS configured with explicit allowlist
- Credentials mode required for sensitive operations
- Production: Add CSRF tokens for state-changing form submissions

## Input Sanitization
- Company name sanitized (< > ' " stripped, max 200 chars)
- All user inputs validated via Zod schemas in tRPC

## Secrets Management
- No hardcoded secrets (was vulnerability in v2 env.ts)
- All secrets via environment variables
- Production env vars validated at startup — missing secrets cause fatal error
- JWT secrets minimum 32 characters enforced

## Audit Logging
- Every analyze request logged (IP, company name first 20 chars, file type, score)
- Financial data itself never logged
- Audit log table in DB schema (users, sessions, audit_logs)

## Saudi PDPL Compliance Readiness
- User data deletion workflow: signOut() + deleteReport() + account deletion endpoint needed
- Data export: getSavedReports() covers user data export
- Data minimization: only necessary fields collected
- No third-party analytics scripts injected
- Consent: registration flow should include ToS + Privacy Policy acceptance

## Known Remaining Gaps (Production Checklist)
- [ ] Server-side JWT auth (replace localStorage auth)
- [ ] Email verification flow
- [ ] Password reset via email (token-based)
- [ ] MFA (TOTP) for admin and high-value users
- [ ] Redis for rate limiting (multi-instance)
- [ ] HttpOnly Secure cookies for refresh tokens
- [ ] WAF (Cloudflare or AWS WAF) in front of API
- [ ] DDoS protection
- [ ] Dependency vulnerability scanning (npm audit in CI)
- [ ] Secret scanning in CI (GitLeaks or GitHub Advanced Security)
- [ ] Penetration testing before launch
- [ ] SOC 2 Type II roadmap
