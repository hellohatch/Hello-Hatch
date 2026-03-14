# Leadership Risk Intelligence™ Platform
**Version 3.0 | Hatch | March 2026**

> A production-ready SaaS platform that detects structural leadership risk before performance decline — operationalising the Leadership Risk Intelligence™ framework.

---

## 🚀 Live Platform

| URL | Description |
|-----|-------------|
| `/login` | Sign in |
| `/dashboard` | Leader Intelligence Dashboard |
| `/org` | Organization Portfolio View |
| `/assessment/new` | Start 36-item assessment |
| `/api/docs` | API Documentation |
| `/api/health` | Platform health check |

**Demo Credentials:**
- Admin: `admin@demo.com` / `password123`
- Leaders: `sarah@demo.com`, `james@demo.com`, `priya@demo.com`, `david@demo.com` / `Welcome2026!`

---

## ✅ Completed Features

### Assessment Engine
- 36-item psychometric instrument (30 signal + 5 load + 1 orientation)
- 6 signal domains × 5 questions each, plus reverse-scored items
- Live progress bar, domain completion tracking
- CEI data capture (optional manual input)

### Analytic Engine — 5-Layer Flow
1. **Leadership Signal Index™ (LSI)** — domain scores averaged → range 1.0–5.0
2. **Leadership Load Index™ (LLI)** — raw + normalized (0–1)
3. **Concentration Exposure Index™ (CEI)** — decision routing ratio
4. **Leadership Cost Cascade™** — 5-stage classification
5. **Leadership Risk Score™** — `(CEI × LLI_norm) / LSI`

### Signal Pattern Classification (4 patterns)
- Organizational Stabilizer
- Strategic Interpreter
- Structural Bottleneck Risk
- Leadership Load Saturation

### Leader Dashboard
- Investor visual: Signal → Load → Concentration → Risk
- Signal Radar chart (Chart.js)
- Leadership Cost Cascade™ visualization
- Risk Score breakdown panel
- Risk Score™ & LSI trajectory charts
- Assessment history table
- Link to Executive Intelligence Brief

### Executive Intelligence Brief (full report)
- Header with composite Risk Score™
- Signal Pattern classification
- Strongest signal & watch area
- Leadership Signal Radar + Scorecard
- Leadership Cost Cascade™ staircase visualization
- Signal Domain Analysis with interpretive text
- Leadership Signal Trajectory™ (3 scenario model)
- Concentration Exposure Interpretation with CEI gauge
- 30-Day Structural Strengthening Plan (pattern-specific)
- Organizational Implications
- Final Perspective narrative
- Print / PDF ready

### Organization Dashboard
- KPI row (leaders, assessed, avg risk, at-risk count)
- Risk Level Distribution doughnut chart
- Leadership Cost Cascade™ distribution bars
- Domain Signal Heatmap (org average per domain)
- Leadership Risk Map table (sorted by risk)
- Leader deep-dive page with radar + trajectory
- Add Leader modal (admin only)

### REST API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Platform status |
| GET | `/api/formulas` | Scoring formula reference |
| GET | `/api/docs` | API documentation |
| POST | `/api/signals/calculate` | Calculate LSI from raw responses |
| POST | `/api/risk/calculate` | Calculate Risk Score from indices |
| GET | `/api/leader/:id/brief` | Structured executive brief JSON |
| GET | `/api/org/portfolio` | Portfolio aggregation (admin) |
| POST | `/api/decisions/ingest` | Ingest decision events for CEI |

### Security & Auth
- Cookie-based sessions (HttpOnly, SameSite=Lax)
- SHA-256 password hashing (Web Crypto API)
- Role-based access (admin / leader)
- 24-hour session expiry

---

## 📊 Scoring Formulas

```
Domain Score = Sum(domain_responses) / 5        → range 1.0–5.0
LSI          = (SR+CB+TC+EI+LD+AC) / 6         → range 1.0–5.0
LLI_raw      = Sum(load_responses) / 5          → range 1.0–5.0
LLI_norm     = (LLI_raw - 1) / 4               → range 0.0–1.0
CEI          = leader_decisions / total_decisions → range 0.0–1.0
Risk Score   = (CEI × LLI_norm) / LSI
```

**Risk Bands:**
| Range | Level |
|-------|-------|
| 0.000–0.050 | Low structural risk |
| 0.051–0.100 | Early exposure |
| 0.101–0.200 | Emerging dependency |
| 0.201–0.350 | Structural bottleneck |
| > 0.350 | Organizational risk |

**CEI / Cascade Thresholds:**
| CEI Range | Stage |
|-----------|-------|
| 0.00–0.30 | Healthy Distribution |
| 0.31–0.45 | Emerging Exposure |
| 0.46–0.65 | Structural Dependency |
| 0.66–0.80 | Decision Bottleneck |
| 0.81–1.00 | Organizational Drag |

---

## 🗄️ Data Architecture

**Storage:** Cloudflare D1 (SQLite)

**Tables:**
- `organizations` — org profile
- `leaders` — users, roles, auth
- `assessments` — assessment instances
- `assessment_responses` — individual question responses (Q01–Q35)
- `decision_events` — routing data for CEI
- `strategic_initiatives` — initiative tracking
- `risk_scores` — computed scores per assessment

---

## 🏗️ Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Cloudflare Workers (edge) |
| Framework | Hono v4 |
| Build | Vite + @hono/vite-cloudflare-pages |
| Database | Cloudflare D1 (SQLite) |
| Frontend | HTML + Tailwind CSS CDN + Chart.js CDN |
| Auth | Web Crypto API (SHA-256, cookie sessions) |
| Deployment | Cloudflare Pages |

---

## 📁 Project Structure

```
webapp/
├── src/
│   ├── index.tsx          # Main app + API docs + favicon
│   ├── routes/
│   │   ├── auth.ts        # Login, register, logout
│   │   ├── assessment.ts  # 36-item instrument + scoring pipeline
│   │   ├── dashboard.ts   # Leader intelligence dashboard
│   │   ├── org.ts         # Organization portfolio + leader deep-dive
│   │   └── api.ts         # REST API endpoints
│   ├── lib/
│   │   ├── auth.ts        # Crypto, sessions, middleware
│   │   ├── questions.ts   # 36-item question bank + domain metadata
│   │   ├── scoring.ts     # Full scoring engine (all 4 models)
│   │   └── brief.ts       # Executive Intelligence Brief generator
│   └── types/
│       └── index.ts       # TypeScript types + interfaces
├── migrations/
│   └── 0001_lri_schema.sql
├── seed.sql               # 5-leader demo data (4 signal patterns)
├── ecosystem.config.cjs   # PM2 config
└── wrangler.jsonc         # Cloudflare config
```

---

## 🎯 Demo Data — Pre-loaded Leaders

| Leader | Role | Risk Score | Risk Level | Signal Pattern |
|--------|------|-----------|------------|----------------|
| James Rivera | VP Engineering | 0.236 | Structural bottleneck | Leadership Load Saturation |
| David Park | VP Sales | 0.112 | Emerging dependency | Structural Bottleneck Risk |
| Alex Morgan | CEO | 0.111 | Emerging dependency | Structural Bottleneck Risk |
| Priya Kapoor | Director Ops | 0.072 | Early exposure | Strategic Interpreter |
| Sarah Chen | CPO | 0.021 | Low structural risk | Organizational Stabilizer |

---

## 🔮 Implementation Phases (from SoW)

- [x] **Phase 1** — Assessment Engine, Signal Index, Executive Brief
- [x] **Phase 2** — Load Index, Risk Score Engine
- [x] **Phase 3** — Decision routing ingestion, Exposure Index (CEI)
- [ ] **Phase 4** — Predictive analytics layer (ML forecasting)

---

## 🚢 Deployment

**Platform:** Cloudflare Pages  
**Status:** ✅ Active (sandbox)  
**Branch:** main  
**Last Updated:** March 2026

### Deploy to Production

```bash
npx wrangler d1 create lri-production
# Update database_id in wrangler.jsonc
npx wrangler d1 migrations apply lri-production
npm run build
npx wrangler pages deploy dist --project-name lri-platform
```

---

## ⚠️ IP Notice

All algorithms, scoring frameworks, trademarked names (Leadership Signal Index™, Leadership Load Index™, Concentration Exposure Index™, Leadership Cost Cascade™, Leadership Risk Score™, Leadership Signal Trajectory™), and associated IP remain the exclusive property of **Hatch**.
