# EEXA Platform v4 — Architecture Documentation

## Overview
EEXA is a Saudi FinTech SaaS platform providing AI-powered financial analysis for Arabic-speaking SMEs.

## Stack
| Layer        | Technology                        |
|--------------|-----------------------------------|
| Frontend     | React 19, TypeScript, Vite 7      |
| Styling      | Tailwind CSS v3, shadcn/ui        |
| Charts       | Chart.js, Recharts                |
| State        | React hooks, tRPC client          |
| Backend      | Hono (Node.js), tRPC              |
| Database     | MySQL + Drizzle ORM               |
| AI           | Anthropic Claude Sonnet 4         |
| File Parse   | pdfjs-dist, xlsx                  |
| Auth         | Web Crypto PBKDF2 (→ JWT in prod) |
| Billing      | Stripe + Moyasar                  |
| Testing      | Vitest                            |

## Project Structure
```
eexa-platform-v4/
├── api/                    # Hono backend
│   ├── boot.ts            # Server entry — security headers, rate limiting, file validation
│   ├── router.ts          # tRPC root router
│   ├── context.ts         # tRPC context
│   ├── middleware.ts      # Auth middleware (public / protected / admin)
│   ├── routers/
│   │   └── chat.ts        # AI chat tRPC router
│   ├── lib/
│   │   ├── env.ts         # Validated environment config
│   │   ├── http.ts        # HTTP utilities
│   │   └── vite.ts        # Static file serving
│   └── queries/
│       └── connection.ts  # DB connection
├── src/                    # React frontend
│   ├── lib/
│   │   ├── financialEngine.ts   # Core calculation engine (32KB)
│   │   ├── semanticMapping.ts  # Column detection engine (17KB)
│   │   ├── authStore.ts        # Client auth + PBKDF2
│   │   ├── formatters.ts       # Safe display formatters
│   │   ├── translations.ts     # AR/EN i18n
│   │   └── utils.ts            # Shared utilities
│   ├── components/
│   │   ├── dashboard/          # Financial panel components
│   │   │   ├── ProfitabilityPanel.tsx
│   │   │   ├── LiquidityPanel.tsx
│   │   │   ├── SolvencyPanel.tsx
│   │   │   ├── EfficiencyPanel.tsx
│   │   │   ├── DuPontPanel.tsx
│   │   │   ├── EarningsQualityPanel.tsx
│   │   │   ├── CashFlowPanel.tsx
│   │   │   ├── ForecastPanel.tsx
│   │   │   ├── ScenarioPanel.tsx
│   │   │   ├── AltmanZPanel.tsx
│   │   │   ├── BeneishMPanel.tsx
│   │   │   └── BenchmarkPanel.tsx
│   │   ├── ui/                 # shadcn/ui base components (40+)
│   │   ├── AuthModal.tsx
│   │   ├── PricingModal.tsx
│   │   ├── ValuationCalculator.tsx
│   │   ├── SmartAlerts.tsx
│   │   ├── SavedReports.tsx
│   │   └── QuickBooksConnect.tsx
│   ├── pages/
│   │   └── Home.tsx            # Main SPA page (818 lines)
│   ├── hooks/
│   │   ├── useLanguage.ts
│   │   └── use-mobile.ts
│   ├── providers/
│   │   └── trpc.tsx
│   └── types/
│       └── financial.ts
├── db/
│   ├── schema.ts               # Full production DB schema
│   ├── relations.ts
│   └── seed.ts
├── tests/
│   └── financial.test.ts       # 40+ ground truth + edge case tests
├── contracts/
│   ├── types.ts
│   └── errors.ts
├── SECURITY.md
├── ARCHITECTURE.md
├── .env.example
└── package.json

```

## Financial Engine Architecture

### Data Flow
```
File Upload (XLSX/CSV/PDF)
    ↓
File Validation (extension + magic bytes)
    ↓
Extraction Engine (extractExcelData / extractCSVData / extractPDFData)
    ↓
Semantic Column Mapping (semanticMapping.ts — 200+ patterns, AR+EN)
    ↓
Data Normalization (normalizeFinancialData)
    ↓
Financial Engine (financialEngine.ts)
    ├── Profitability Ratios (8 metrics)
    ├── Liquidity Ratios (5 metrics)
    ├── Solvency Ratios (5 metrics)
    ├── Efficiency Ratios (9 metrics)
    ├── DuPont Analysis
    ├── Earnings Quality
    ├── Cash Flow Analysis
    ├── Altman Z-Score (Z' private company model)
    ├── Beneish M-Score (8 components)
    ├── Financial Score (0-100)
    ├── Forecasting (linear regression, 12 periods)
    ├── Scenario Analysis (best/base/worst)
    ├── Benchmarking (11 metrics vs industry)
    └── Smart Alerts (priority-sorted)
    ↓
AI Insights (Claude Sonnet 4 — data-grounded, no hallucination)
    ↓
Response to Frontend
```

## Billing Plans

| Plan         | Price       | Reports/Month | Features                  |
|--------------|-------------|---------------|---------------------------|
| Free         | 0 SAR       | 3             | Basic analysis            |
| Professional | 199 SAR/mo  | Unlimited     | Full analysis + QuickBooks|
| Business     | 499 SAR/mo  | Unlimited     | + Team + Priority support |
| Enterprise   | Custom      | Unlimited     | + SLA + API access        |

## Multi-Tenancy
- Every report is tagged with userId AND companyId
- API queries always filter by userId — cross-tenant access impossible
- DB schema has companyId on users, reports tables
- Soft deletes throughout (deletedAt field)

## Supported Industries (Benchmarking)
Retail, Healthcare, Manufacturing, Technology, Construction, Logistics, Restaurants, Wholesale, Services

## Integration Roadmap
- Qoyod, Wafeq (Saudi ERP)
- QuickBooks, Xero (SME accounting)
- SAP, Oracle NetSuite (Enterprise)
- Moyasar (Saudi card payments — MADA support)
- Stripe (international cards)
