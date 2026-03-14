# Leadership Risk Intelligence™ Platform v3.1

> Predictive SaaS platform that detects structural leadership risk **before** performance decline.

---

## 🌐 Live URLs

| Endpoint | URL |
|---|---|
| **Platform** | https://3000-ii3oqi39o793it57sowde-a402f90a.sandbox.novita.ai |
| **API Health** | https://3000-ii3oqi39o793it57sowde-a402f90a.sandbox.novita.ai/api/health |
| **Formula Reference** | https://3000-ii3oqi39o793it57sowde-a402f90a.sandbox.novita.ai/api/formulas |
| **API Docs** | https://3000-ii3oqi39o793it57sowde-a402f90a.sandbox.novita.ai/api/docs |

**Demo login:** `admin@demo.com` / `password123`

---

## ✅ v3.1 Completed Features

### Scoring Engine (v3.1 — Venture-Grade Corrections)
| Model | Formula | Range |
|---|---|---|
| **LSI™** | `(SR + CB + TC + EI + LD + AC) / 6` | 1.0–5.0 |
| **LSI_norm** *(NEW v3.1)* | `LSI / 5` | 0.0–1.0 |
| **LLI_norm** | `(LLI_raw - 1) / 4` | 0.0–1.0 |
| **CEI** | `leader_decisions / total_decisions` | 0.0–1.0 |
| **Risk Score** *(v3.1 CORRECTED)* | `(CEI × LLI_norm) / LSI_norm` | 0.0–∞ |
| **Decision Velocity** *(NEW v3.1)* | `total_decisions / days_elapsed` | decisions/day |

> **v3.1 Correction:** Denominator changed from raw LSI (1–5 scale) to LSI_norm (0–1 scale), aligning all three formula variables to the same range for mathematical consistency and improved signal power.

### Risk Thresholds (v3.1 Recalibrated)
| Risk Score | Level | Cascade Stage |
|---|---|---|
| 0.000–0.030 | Low structural risk | Healthy Distribution |
| 0.031–0.080 | Early exposure | Emerging Exposure |
| 0.081–0.150 | Emerging dependency | Structural Dependency |
| 0.151–0.300 | Structural bottleneck | Decision Bottleneck |
| > 0.300 | Organizational risk | Organizational Drag |

> **v3.1 Correction:** Cost Cascade stage is now classified by **Risk Score** (not CEI alone), reflecting true structural risk as a composite of signals, load, and concentration.

### Demo Portfolio Distribution
| Leader | Risk Score | Level | Cascade |
|---|---|---|---|
| James Rivera | 0.220 | Structural bottleneck | Decision Bottleneck |
| David Park | 0.120 | Emerging dependency | Structural Dependency |
| Alex Morgan | 0.100 | Emerging dependency | Structural Dependency |
| Priya Kapoor | 0.055 | Early exposure | Emerging Exposure |
| Sarah Chen | 0.018 | Low structural risk | Healthy Distribution |

### Dashboards
- **Leader Dashboard** — Signal Radar (Chart.js), Leadership Load, Decision Concentration, **Decision Velocity** (NEW), Cost Cascade (Risk Score–driven), Signal Pattern, Risk Breakdown, Trend Charts, Assessment History
- **Organization Dashboard** — Decision Gravity Map™ (Canvas network visualization), Portfolio Risk Distribution (stacked bar + doughnut), Organizational Risk Heatmap™ (by role level: C-Suite, VP, Director), Leadership Cost Cascade distribution, Domain Signal Heatmap, Decision Velocity panel
- **Executive Intelligence Brief** — 10-section full report with Signal Radar, domain analysis, trajectory scenarios, 30-day plan, organizational implications (PDF-printable)

### REST API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/signals/calculate` | Compute domain scores + LSI |
| `POST` | `/api/risk/calculate` | Compute LLI, CEI, Risk Score v3.1 |
| `GET` | `/api/leader/:id/brief` | Full JSON executive brief |
| `GET` | `/api/org/portfolio` | Org-level aggregated risk data |
| `GET` | `/api/formulas` | Formula reference with v3.1 corrections |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/docs` | Interactive API documentation |

---

## 🏗️ Architecture

### Tech Stack
- **Runtime:** Hono framework + Cloudflare Workers/Pages
- **Database:** Cloudflare D1 (SQLite, edge-distributed)
- **Frontend:** Tailwind CSS + Chart.js + Custom Canvas (Gravity Map)
- **Auth:** Session cookie + password hashing (Web Crypto API)
- **Build:** Vite + TypeScript → Cloudflare Workers bundle

### Data Model
```
organizations → leaders → assessments → assessment_responses
                       ↓
                  risk_scores (LSI, LSI_norm, LLI, CEI, Risk Score, Cascade)
decision_events (for live CEI + Decision Velocity)
strategic_initiatives
```

### Assessment Instrument
- **36 questions total:** 30 signal items (6 domains × 5 Qs), 5 load items, 1 orientation
- **~6 minutes** completion time
- **Reverse-scored items:** Q04, Q09, Q14, Q18, Q23, Q25, Q28, Q30

---

## 🛣️ Implementation Roadmap

| Phase | Status | Description |
|---|---|---|
| **Phase 1** | ✅ Complete | Assessment Engine, Signal Index, Executive Brief |
| **Phase 2** | ✅ Complete | Load Index, Risk Score Engine, v3.1 corrections |
| **Phase 3** | ✅ Complete | Decision Gravity Map, Portfolio Analytics, Heatmap, Velocity |
| **Phase 4** | 🔲 Pending | Predictive analytics layer, longitudinal ML models |

---

## 🔐 Demo Credentials
| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.com` | `password123` |
| Leader | `sarah@demo.com` | `password123` |
| Leader | `james@demo.com` | `password123` |

Default password for new leaders: `Welcome2026!`

---

## 📐 Deployment

- **Platform:** Cloudflare Pages
- **Status:** ✅ Active (Sandbox)
- **Last Updated:** March 14, 2026
- **Version:** v3.1 (venture-grade corrections applied)
