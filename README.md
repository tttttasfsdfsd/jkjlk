# EEXA Platform v4 — AI-Powered Financial Analysis for Saudi SMEs

> منصة التحليل المالي الذكية للشركات السعودية الناشئة والمتوسطة

## What's New in v4

### 🔐 Security Hardening
- **CRITICAL FIX:** Passwords now hashed with PBKDF2 (100,000 iterations, SHA-256) — were stored as base64 (plaintext) in v2
- Security headers: CSP, X-Frame-Options, HSTS, XSS protection, nosniff
- Rate limiting: 100 req/15min global, 10 analyzes/15min per IP
- File validation: extension allowlist + magic bytes verification
- CORS restricted to explicit domain allowlist
- User enumeration prevention
- Structured audit logging (no financial data in logs)

### 🗄️ Database Schema (Production-Ready)
- Full MySQL schema: users, companies, reports, sessions, subscriptions, audit_logs
- Multi-tenant isolation by userId + companyId
- Soft deletes throughout
- Proper indexes on all query patterns

### 🛡️ RBAC (Role-Based Access Control)
Roles: `admin` | `analyst` | `sme_owner` | `accountant` | `viewer`

### 📋 Documentation
- `SECURITY.md` — Security guide + pre-launch checklist
- `ARCHITECTURE.md` — Full system architecture + data flow
- `AUDIT_REPORT.md` — Complete audit findings + scoring

### 🧪 Expanded Tests
40+ tests covering:
- Ground truth formulas (tolerance ≤ 0.01)
- Edge cases (zero, negative, extreme values)
- DuPont, Cash Flow, Earnings Quality
- Beneish M-Score with/without prior period
- Smart alert triggers
- Precision validation

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Fill in ANTHROPIC_API_KEY (required for AI insights)

# Run tests
npm test

# Development
npm run dev:all   # API + Frontend

# Production build
npm run build
npm start
```

## Environment Variables

See `.env.example` for all required and optional variables.

**Required for AI:** `ANTHROPIC_API_KEY`  
**Required for production:** `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`  
**Required for billing:** `STRIPE_SECRET_KEY` or `MOYASAR_SECRET_KEY`

## Financial Metrics Supported

**Profitability:** Gross Margin, Operating Margin, EBITDA Margin, Net Margin, ROA, ROE, ROCE, ROIC  
**Liquidity:** Current Ratio, Quick Ratio, Cash Ratio, Working Capital, OCF Ratio  
**Solvency:** Debt Ratio, D/E, Equity Ratio, Interest Coverage, Financial Leverage  
**Efficiency:** Asset Turnover, Inventory Turnover, DSO, DIO, DPO, CCC, Fixed Asset Turnover  
**Advanced:** Altman Z-Score, Beneish M-Score, DuPont Analysis, Earnings Quality  
**Forecasting:** Revenue, Profit, Cash Flow, Working Capital (12-period linear regression)  
**Scenarios:** Best / Base / Worst case analysis  
**Risk Score:** 0-100 composite financial health score

## Supported File Formats

| Format | Status | Notes |
|--------|--------|-------|
| XLSX | ✅ | Multi-sheet, Arabic numerals |
| XLS | ✅ | Legacy Excel |
| XLSM | ✅ | Macro-enabled (macros not executed) |
| CSV | ✅ | UTF-8, Arabic-Indic digits |
| PDF | ✅ | Text-layer PDFs |
| Scanned PDF | ⚠️ | Planned (OCR in v5) |

## Billing Plans

| Plan | Price | Reports | Features |
|------|-------|---------|---------|
| Free | 0 SAR | 3/month | Full analysis |
| Professional | 199 SAR/mo | Unlimited | + QuickBooks |
| Business | 499 SAR/mo | Unlimited | + Team + Priority |
| Enterprise | Custom | Unlimited | + API + SLA |

## Production Readiness: 61/100

See `AUDIT_REPORT.md` for full scoring and pre-launch checklist.

**Must complete before launch:**
1. Server-side JWT authentication
2. Email verification
3. Stripe/Moyasar webhook handlers
4. Penetration test
5. Privacy policy (PDPL compliance)

## Architecture

See `ARCHITECTURE.md` for full technical architecture documentation.

## Running Tests

```bash
npm test
# Runs 40+ ground truth + edge case tests
# All formulas verified to tolerance ≤ 0.01
```
