<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/brand/logo-light.svg">
  <img alt="Mardom / مردم — Persian Synthetic Crowd Ad Lab" src="docs/brand/logo-dark.svg" width="540">
</picture>

<p>
  <strong>Test and evolve Persian ads against 1,000 synthetic Iranian buyer personas before spending budget.</strong>
</p>

<p>
  <a href="#demo">Demo</a> &nbsp;·&nbsp;
  <a href="#quick-start">Quick Start</a> &nbsp;·&nbsp;
  <a href="#why-naive-synthetic-audiences-fail">Design Notes</a> &nbsp;·&nbsp;
  <a href="#sanity-benchmark">Benchmarks</a> &nbsp;·&nbsp;
  <a href="#persian-summary">راهنمای فارسی</a>
</p>

</div>

---

<a id="demo"></a>

<div align="center">
  <a href="docs/demo.mp4">
    <img src="docs/demo.gif" alt="Mardom live demo: 1.5s A/B Battle Arena, Buyer Archetype Vote Matrix, Evolution Holdout, Causal X-Ray & Social Contagion" width="100%">
  </a>
  <p><sub>Live ~1.5s A/B/C Battle Arena (notice <b>Deal-Hunters</b> flipping 92% to the 20% Off variant), Unseen Holdout validation, Causal X-Ray &amp; 2nd-Order Social Contagion · <a href="docs/demo.mp4">Download 60fps HD MP4 (5.9 MB)</a></sub></p>
</div>

```text
  input ad + product facts (IG Story / Reels / Telegram / Yektanet / Divar)
    │
    ├─▶ 4-director creative room (deepseek-flash) ──▶ 8 variants + fact/brief audit
    │
    ├─▶ 1,000 Iranian personas (pplx-decider-v1.3) ──▶ 2-stage funnel + rotated tournament
    │
    └─▶ unseen holdout (n=48) + causal X-ray + comment-section stress test ──▶ champion ad
```

**No vanity LLM rubrics. No argmax clone collapse.** Mardom pairs **1,000 grounded Iranian personas** (44 cities, 31 provinces, realistic Toman income tiers, 8 buyer decision archetypes) with `pplx-decider-v1.3` for fast probabilistic crowd scoring (`~$0.004` per A/B battle) and `deepseek-flash` for creative evolution, fact verification, and live 1-on-1 persona interviews.

<a id="persian-summary"></a>
<details>
<summary><strong>توضیح کوتاه به فارسی (Persian Summary)</strong></summary>

<br/>

**مردم (Mardom)** یک آزمایشگاه متن‌باز برای تست و تکامل تبلیغات فارسی (استوری ۳ فریمی و ریلز اینستاگرام، تلگرام، همسان یکتانت و دیوار) روی بانک **۱٬۰۰۰ پرسونای ایرانی** از ۴۴ شهر ایران است.

- **نبرد سریع A/B/C (~۱.۵ ثانیه):** ۲ تا ۴ تبلیغ را همزمان جلوی جمعیت واقعی ایرانی بگذارید و سهم رأی هر تیپ خریدار و گلوگاه قیف را ببینید.
- **تکامل خودکار تبلیغ:** تولید ۸ ایده از ۴ زاویه خلاقانه، ممیزی واقعیت بدون توهم، تورنمنت بدون سوگیری ترتیب، تایید روی جمعیت پنهان (Holdout)، کالبدشکافی علّی (تیتر در برابر پیشنهاد) و تست سرایت اجتماعی کامنت‌ها.
- **اجرای فوری بدون API Key:** پروژه با بانک کامل ۱٬۰۰۰ پرسونا و ۳ آزمایش کامل ذخیره شده عرضه می‌شود؛ بلافاصله پس از `bun run dev` قابل بررسی است.

</details>

---

## Real Output

Passing a generic Instagram Reels draft for an Iranian AI course (`Maktabkhooneh`) through 2 generations of evolution:

| Stage | Before (Original) | After Evolution (Champion) |
| --- | --- | --- |
| **0–3s Hook** | معرفی دوره جامع هوش مصنوعی مکتب‌خونه | دوره ChatGPT مکتب‌خونه رو نخر، اول جلسه رایگانش رو ببین |
| **CTA** | لینک ثبت‌نام در بیو | «جلسه» رو کامنت کن |
| **Unseen Holdout (`n=48`)** | `12.1` (`~0.83%` proxy CTR) | **`54.5`** (`+42.4`, `p < 0.001`, `97.8%` head-to-head win) |
| **Comment Stress Test** | — | Auto-optimized weak admin replies (`17.4% → 48.9%` trust recovery) and flagged 3 missing brief facts (exact price, concrete tool names, live vs. recorded) |

---

## Quick Start

> [!TIP]
> **No API keys needed to explore.** The repo ships with all **1,000 Iranian personas** (`data/iran_crowd.json`) and **3 full saved runs** (`data/runs/sample_*.json`). Run `bun run dev` and open the **جمعیت (Crowd)** and **تاریخچه (History)** tabs immediately.

```bash
git clone https://github.com/BlacKSnowDot0/Crowrd.git
cd Crowrd
bun install      # or: npm install
bun run dev      # http://localhost:3000
```

### Enable Live Runs

```bash
cp .env.example .env
```

Add your keys to `.env`:

| Variable | Model | Role |
| --- | --- | --- |
| `PERPLEXITY_API_KEY` | `pplx-decider-v1.3` | Crowd behavioral simulation, rotated tournaments, Battle Arena, Price Lab, X-Ray, Social Contagion |
| `DEEPSEEK_API_KEY` | `deepseek-flash` | 4-Director Creative Room, fact & brief audit, comment simulation, admin reply optimizer, live interviews |

### Wall Time & API Cost

| Workflow | Endpoint | Wall Time | Approx. Cost |
| --- | --- | ---: | ---: |
| **Instant A/B/C/D Battle** | `POST /api/battle` | `1.3–2.5s` | `~$0.004` |
| **Price & BNPL Elasticity** | `POST /api/price-lab` | `2–4s` | `~$0.005` |
| **Full Ad Evolution + Holdout + Post-Launch Suite** | `POST /api/evolve` | `70–118s` | `~$0.027–$0.038` |

---

## Why Naive Synthetic Audiences Fail

Early prototypes (V1–V4) broke in four concrete ways that forced the current architecture:

1. **Paranoid scam-auditor collapse:** Telling personas to "be skeptical of ads" caused them to reject normal offers unless the copy read like legal fine print. Fixed by replacing global skepticism prompts with **8 authentic Iranian buyer lenses** (`ARCHETYPE_LENS` in `src/lib/decider.ts`).
2. **Reward-hacking freebies & fine print:** Additive fitness scores let the optimizer game the crowd by stuffing "free" or "23% annual interest" into headlines. Fixed with a **2-stage multiplicative funnel** (`Relevance × Headline-Only Stop × 3s Clarity × Pull × Trust`) plus strict brief-fidelity and fact checks against `productTruth`.
3. **Clone homogeneity (`60/60 curious`, `std = 1.6`):** Using `argmax` over reaction probabilities + a global editorial rubric crushed demographic disagreement. Removing global taste rubrics and switching to deterministic relevance-calibrated probabilistic sampling restored real spread (`std = 9.5–18.7`).
4. **Position bias & fake Instagram formats:** Multi-choice models systematically favored Option 1, and `Headline + Body + CTA` copy made no sense for Instagram. Every tournament/duel now rotates option order cyclically (`runRotatedTournament`, `evaluateFeedBattle`, `evaluateBattleArena`) with explicit `tie` choices, and all 5 Iranian platforms (`instagram_story`, `instagram_reels`, `telegram`, `banner`/Yektanet `<= 48` chars, `divar`) use native format rules and Stage-1 stop physics.

---

## Sanity Benchmark

Run the empirical validation suite (`experiments/v5_predictive_benchmark.py`):

```bash
python3 experiments/v5_predictive_benchmark.py
```

| Check | Result |
| --- | --- |
| **6-Category Pairwise Accuracy** (Fintech, Insurance, EdTech, Skincare, B2B SaaS, Grocery) | **`6 / 6` (100%)** · within-ad `std = 9.5–18.7` |
| **ICP vs. Non-ICP Relevance Separation** | **`4.1×`** |
| **Demographic Double-Crossover** (Tehran Affluent vs. Provincial Budget) | Passes (Luxury Coffee vs. BNPL Essentials flip) |
| **IG Story Native Format Physics** (3-Frame Story vs. Bloated Paragraph, `n=24`) | Frame-1 Stay **`63.0%` vs `15.8%`** · Sticker Tap **`70.1%` vs `9.6%`** |

> [!NOTE]
> **Honest limitations:** Mardom is a strong copywriting & offer stress-tester, not a crystal ball. It cannot see your actual Reel video, pacing, face/voice, influencer trust, or sudden currency/macro shocks—and `~CTR%` is a relative behavioral proxy, not calibrated against live Yektanet or Instagram spend data.

---

## Screenshots & Repo Map

<details>
<summary><strong>View full-resolution UI screenshots &amp; project structure</strong></summary>

<br/>

#### Evolutionary Ad Studio (Original vs. Champion + Holdout)
![Evolution Dashboard][shot-evo]

#### Instant A/B/C Battle Arena + Buyer Archetype Matrix
![Battle Arena][shot-battle]

#### 1,000-Persona Iranian Crowd Explorer
![Crowd Explorer][shot-crowd]

```text
data/
  iran_crowd.json                 # 1,000 grounded Iranian personas (44 cities)
  runs/sample_*.json              # 3 curated V7 runs for zero-key UI exploration
docs/
  brand/                          # Adaptive SVG logo mark + dark/light wordmarks
  demo.mp4 / demo.gif             # 60fps studio walkthrough & README preview
  screenshots/                    # Full-resolution UI captures
experiments/
  v5_predictive_benchmark.py      # 6-category behavioral physics validation suite
  crowd_quality_eval.py           # Persona bank diversity & calibration eval
scripts/
  scale_crowd.py                  # 1,000-persona generator
  optimize_crowd.py               # De-cliché & deepening optimization pass
src/
  lib/decider.ts                  # pplx-decider-v1.3 behavioral physics, tournaments, X-ray, contagion
  lib/deepseek.ts                 # deepseek-flash creative room, fact audit, comment & reply optimizer
  lib/crowd-store.ts              # File-based persona & run storage
  app/api/                        # evolve, battle, price-lab, crowd, icp, interview, post-kit, runs
  components/                     # Next.js 15 + Tailwind v4 Persian RTL UI
```

</details>

---

## Adapting to Another Market

`data/iran_crowd.json` is built for Iran in Persian, but the engine itself is market-agnostic: swap the persona JSON schema + the 8 archetype lenses in `src/lib/decider.ts` and platform rules in `src/lib/deepseek.ts` to run the same evolutionary + behavioral pipeline in any language or country.

## License

[MIT](LICENSE)

[shot-evo]: docs/screenshots/evolution-dashboard.png
[shot-battle]: docs/screenshots/battle-arena.png
[shot-crowd]: docs/screenshots/crowd-explorer.png
