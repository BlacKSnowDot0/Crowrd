#!/usr/bin/env python3
"""
Crowd (مردم) — Step 5: Rigorous Empirical BEFORE vs RAW-1000 vs OPTIMIZED-1000 Evaluation
Evaluates:
  1) Intrinsic Bank Quality Metrics (including size-matched 300-sample bootstrap for fair
     lexical/entropy comparison between 300-profile BEFORE and 1,000-profile RAW/OPTIMIZED!)
  2) Sub-segment Depth across 5 realistic Iranian marketing target slices
  3) Live Behavioral Evaluation on `pplx-decider-v1.3` (stratified 60-persona panel x 2 real
     Iranian ads: Bad Spammy Ad vs Solid Trustworthy Ad) measuring Discrimination Gap,
     Signal-to-Noise (Cohen's d), Response Variance / Realism Spread, and Skepticism Calibration!

Saves full JSON report to: experiments/results/crowd_before_after_eval.json
"""

import asyncio
import json
import math
import os
import random
import re
import statistics
import time
from collections import Counter, defaultdict
from pathlib import Path
import aiohttp

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RESULTS_DIR = ROOT / "experiments" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

BANKS = {
    "BEFORE_300": DATA_DIR / "iran_crowd_before.json",
    "RAW_1000": DATA_DIR / "iran_crowd_raw_1000.json",
    "OPTIMIZED_1000": DATA_DIR / "iran_crowd.json",
}
OUT_JSON = RESULTS_DIR / "crowd_before_after_eval.json"

for line in open(ROOT / ".env", encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ[k] = v

PPLX_KEY = os.environ["PERPLEXITY_API_KEY"]
PPLX_URL = "https://api.perplexity.ai/v1/decisions"
DECIDER_MODEL = "pplx-decider-v1.3"
PRICE_PER_M_INPUT = 0.02

CLICHE_PHRASES = [
    "از آن روز", "از آن موقع", "از آن به بعد", "از اون روز", "از اون موقع", "از اون به بعد",
    "ساعت مچی", "پکیج درآمد", "درآمد اینترنتی", "یک بار از یک پیج", "یه بار از یه پیج",
    "بچه‌ها یه پیج", "پشتیبانی گوشی را قطع", "فقط تا امشب", "فرصت طلایی",
]

IRAN_LOCAL_ANCHORS = [
    "دیجی‌کالا", "ترب", "باسلام", "دیوار", "اسنپ", "اسنپ‌پی", "دیجی‌پی", "تارا",
    "بلوبانک", "ویپاد", "طلاین", "طلاسی", "طلا", "تتر", "نوبیتکس", "اینماد", "شاپرک",
    "ایتا", "روبیکا", "بله", "تلگرام", "اینستاگرام", "فیلترشکن", "تیپاکس", "کافه‌بازار",
    "شاد", "صیادی", "کالابرگ", "تپسی", "بانک",
]

LUXURY_HOODS = {
    "الهیه", "زعفرانیه", "فرمانیه", "نیاوران", "ولنجک", "پاسداران", "سعادت‌آباد", "شهرک غرب",
    "جردن", "دروس", "قلهک", "ولیعصر تبریز", "زعفرانیه تبریز", "سجاد", "کیانپارس", "گلسار",
    "معالی‌آباد", "عظیمیه",
}

# Two contrasting real Iranian ads for live pplx-decider-v1.3 behavioral proof
ADS = {
    "bad_spammy": {
        "label": "تبلیغ زرد و مشکوک (Bad/Spammy)",
        "platform": "instagram",
        "headline": "🔥 فرصت طلایی فقط تا امشب! ۷۵٪ تخفیف واقعی و درآمد میلیونی از گوشی",
        "body": (
            "بچه‌ها یه محصول و پکیج فوق‌العاده آوردیم که کل زندگیتون رو زیر و رو می‌کنه! "
            "بدون نیاز به سرمایه و سابقه، ظرف یک هفته نتیجه تضمینی می‌گیرید و سودش چند برابر هزینه‌ست. "
            "به دلیل استقبال بی‌نظیر، برای دریافت قیمت و شماره کارت همین الان کلمه «ثروت» رو دایرکت بفرستید؛ "
            "ظرفیت فقط برای ۱۰ نفر اول تا ساعت ۱۲ امشب!"
        ),
        "cta": "همین الان دایرکت بده و رزرو کن",
    },
    "solid_realistic": {
        "label": "تبلیغ واقعی و شفاف ایرانی (Solid/Trustworthy)",
        "platform": "instagram",
        "headline": "کفش پیاده‌روی روزمره چرم طبیعی تبریز — مستقیم از کارگاه بدون واسطه",
        "body": (
            "چرم گاوی دباغی تبریز با کفی طبی سبک برای استفاده طولانی روزانه. "
            "قیمت شفاف: ۱ میلیون و ۸۹۰ هزار تومان (یا ۴ قسط ۴۷۲ هزار تومانی بدون کارمزد با اسنپ‌پی). "
            "دارای اینماد فعال، ۷ روز ضمانت تعویض سایز و مرجوعی بی‌قیدوشرط، ارسال با کد رهگیری پستی به سراسر ایران "
            "و نظرات واقعی خریداران در صفحه محصول."
        ),
        "cta": "مشاهده مدل‌ها و نظرات خریداران در سایت",
    },
}


def shannon_entropy(counter: Counter) -> float:
    total = sum(counter.values())
    if total == 0:
        return 0.0
    return -sum((c / total) * math.log2(c / total) for c in counter.values() if c > 0)


def lexical_metrics_for_subset(profiles: list) -> dict:
    total_bi = 0
    uniq_bi = set()
    total_tri = 0
    uniq_tri = set()
    op3 = Counter()
    vop2 = Counter()
    ng4_df = Counter()

    for p in profiles:
        ws = p["life_story"].split()
        for i in range(len(ws) - 1):
            uniq_bi.add((ws[i], ws[i + 1]))
            total_bi += 1
        for i in range(len(ws) - 2):
            uniq_tri.add((ws[i], ws[i + 1], ws[i + 2]))
            total_tri += 1
        if len(ws) >= 3:
            op3[" ".join(ws[:3])] += 1
        vs = p["voice_sample"].split()
        if len(vs) >= 2:
            vop2[" ".join(vs[:2])] += 1
        for g in set(" ".join(ws[i : i + 4]) for i in range(max(0, len(ws) - 3))):
            ng4_df[g] += 1

    n = max(1, len(profiles))
    max_4g = ng4_df.most_common(1)[0][1] if ng4_df else 0
    return {
        "distinct_bigram_ratio": uniq_bi.__len__() / max(1, total_bi),
        "distinct_trigram_ratio": uniq_tri.__len__() / max(1, total_tri),
        "opener3_entropy": shannon_entropy(op3),
        "opener3_unique_pct": 100.0 * len(op3) / n,
        "voice2_entropy": shannon_entropy(vop2),
        "voice2_unique_pct": 100.0 * len(vop2) / n,
        "max_4gram_pct": 100.0 * max_4g / n,
    }


def evaluate_intrinsic(name: str, profiles: list) -> dict:
    n = len(profiles)
    rng = random.Random(1405)

    # Full-bank lexical
    full_lex = lexical_metrics_for_subset(profiles)

    # Size-matched 300-profile bootstrap (20 draws) so 300 vs 1,000 lexical diversity is 100% apple-to-apple!
    if n > 300:
        draws = [lexical_metrics_for_subset(rng.sample(profiles, 300)) for _ in range(20)]
        matched300_lex = {k: round(statistics.mean(d[k] for d in draws), 4) for k in full_lex}
    else:
        matched300_lex = {k: round(v, 4) for k, v in full_lex.items()}

    # Cliché / trope repetition
    cliche_hits = 0
    per_cliche = Counter()
    for p in profiles:
        ls = p["life_story"]
        hit = False
        for c in CLICHE_PHRASES:
            if c in ls:
                per_cliche[c] += 1
                hit = True
        if hit:
            cliche_hits += 1

    # 4-gram repetition across full bank
    ng4_df = Counter()
    for p in profiles:
        ws = p["life_story"].split()
        for g in set(" ".join(ws[i : i + 4]) for i in range(max(0, len(ws) - 3))):
            ng4_df[g] += 1
    thresh_2pct = max(6, int(round(0.02 * n)))
    echo_4grams = {g for g, c in ng4_df.items() if c >= thresh_2pct}
    profiles_with_echo = 0
    for p in profiles:
        ws = p["life_story"].split()
        p4 = {" ".join(ws[i : i + 4]) for i in range(max(0, len(ws) - 3))}
        if p4 & echo_4grams:
            profiles_with_echo += 1

    # Grounding density
    has_num = sum(1 for p in profiles if re.search(r"[0-9۰-۹]+|میلیون|هزار|تومان|تومن", p["life_story"]))
    has_loc = sum(1 for p in profiles if (p["city"] in p["life_story"] or p["neighborhood"] in p["life_story"]))
    anchor_counts = [sum(1 for a in IRAN_LOCAL_ANCHORS if a in p["life_story"]) for p in profiles]
    has_3plus_anchors = sum(1 for c in anchor_counts if c >= 3)
    modern_1405_tools = ["فیلترشکن", "بلوبانک", "ویپاد", "تارا", "طلاین", "طلاسی", "تتر", "بله", "اسنپ‌پی", "دیجی‌پی", "باسلام", "ترب"]
    has_modern_1405 = sum(1 for p in profiles if any(t in p["life_story"] for t in modern_1405_tools))

    # Word count distribution
    wcs = sorted(len(p["life_story"].split()) for p in profiles)
    in_ideal = sum(1 for w in wcs if 100 <= w <= 155)
    under_95 = sum(1 for w in wcs if w < 95)
    over_165 = sum(1 for w in wcs if w > 165)

    # Voice uniqueness
    unique_voices = len(set(p["voice_sample"].strip() for p in profiles))

    # Trigger & red_flag diversity
    tr_c = Counter(t.strip() for p in profiles for t in p.get("triggers", []))
    rf_c = Counter(r.strip() for p in profiles for r in p.get("red_flags", []))
    tr_top5_share = 100.0 * sum(c for _, c in tr_c.most_common(5)) / max(1, sum(tr_c.values()))
    rf_top5_share = 100.0 * sum(c for _, c in rf_c.most_common(5)) / max(1, sum(rf_c.values()))

    # Contradictions & socioeconomic realism errors
    c_single_spouse = sum(
        1 for p in profiles
        if p["marital_status"] == "مجرد" and any(w in p["life_story"] for w in ["شوهرم", "همسرم", "زن و بچه", "خانمم", "بچه‌هام", "فرزندانم", "دخترم", "پسرم"])
    )
    c_owner_rent = sum(
        1 for p in profiles
        if p["housing"] == "مالک" and re.search(r"(?:اجاره[\u200c ]?(?:خانه|خونه|آپارتمان|مسکن|ماهی|ماهانه)?\s*(?:می‌دهم|می‌دم|بدم|بدهم|سنگین|بالا|دارم)|صاحبخانه|صاحبخونه|اجاره‌نشین)", p["life_story"])
    )
    c_single_housewife = sum(1 for p in profiles if p["job"].startswith("خانه‌دار") and p["marital_status"] == "مجرد")
    c_tehran_shah = sum(1 for p in profiles if p["city"] == "تهران" and (any("شهرستان" in t for t in p.get("triggers", [])) or "ارسال به شهرستان" in p["life_story"]))
    c_poor_lux_renter = sum(1 for p in profiles if p["housing"] == "مستاجر" and p["monthly_income_m"] < 40 and p["neighborhood"] in LUXURY_HOODS)
    total_logic_errors = c_single_spouse + c_owner_rent + c_single_housewife + c_tehran_shah + c_poor_lux_renter

    # Skepticism spread
    skep_dist = Counter(p["ad_skepticism"] for p in profiles)

    # Sub-segment depth (5 real Iranian advertiser slices!)
    sub_segments = {
        "women_25_40_metro_high_income": sum(
            1 for p in profiles
            if p["gender"] == "زن" and 25 <= p["age"] <= 40
            and p["city_tier"] in ("تهران", "کلان‌شهر")
            and p["income_tier"] in ("متوسط رو به بالا", "مرفه")
        ),
        "youth_19_27_students_or_renters": sum(
            1 for p in profiles
            if 19 <= p["age"] <= 27 and (p["sector"] == "دانشجویی" or p["housing"] == "مستاجر")
        ),
        "gov_retirees_provinces_counties": sum(
            1 for p in profiles
            if p["sector"] in ("دولتی", "بازنشستگی", "آموزش") and p["city_tier"] in ("مرکز استان", "شهرستان")
        ),
        "merchants_shop_owners_50m_plus": sum(
            1 for p in profiles
            if p["sector"] in ("تجارت سنتی", "کسب‌وکار خُرد") and p["monthly_income_m"] >= 50
        ),
        "tech_eng_men_30_50_metro": sum(
            1 for p in profiles
            if p["gender"] == "مرد" and 30 <= p["age"] <= 50
            and p["sector"] in ("فناوری", "مهندسی") and p["city_tier"] in ("تهران", "کلان‌شهر")
        ),
    }

    return {
        "bank": name,
        "count": n,
        "unique_names": len(set(p["name"] for p in profiles)),
        "unique_provinces": len(set(p["province"] for p in profiles)),
        "unique_cities": len(set(p["city"] for p in profiles)),
        "unique_neighborhoods": len(set((p["city"], p["neighborhood"]) for p in profiles)),
        "unique_jobs": len(set(p["job"] for p in profiles)),
        "gender_split": dict(Counter(p["gender"] for p in profiles)),
        "city_tier_split": dict(Counter(p["city_tier"] for p in profiles)),
        "income_tier_split": dict(Counter(p["income_tier"] for p in profiles)),
        "skepticism_split": {str(k): skep_dist.get(k, 0) for k in range(1, 6)},
        "skepticism_entropy": round(shannon_entropy(skep_dist), 3),
        "lexical_full": {k: round(v, 4) for k, v in full_lex.items()},
        "lexical_matched_300": matched300_lex,
        "cliche_profile_pct": round(100.0 * cliche_hits / n, 2),
        "cliche_profile_count": cliche_hits,
        "top_cliches": per_cliche.most_common(5),
        "max_4gram_freq": ng4_df.most_common(1)[0][1],
        "max_4gram_pct": round(100.0 * ng4_df.most_common(1)[0][1] / n, 2),
        "top_3_4grams": ng4_df.most_common(3),
        "profiles_with_2pct_echo_4gram_pct": round(100.0 * profiles_with_echo / n, 2),
        "grounding": {
            "has_toman_or_number_pct": round(100.0 * has_num / n, 1),
            "has_city_or_hood_pct": round(100.0 * has_loc / n, 1),
            "has_3plus_iran_anchors_pct": round(100.0 * has_3plus_anchors / n, 1),
            "avg_iran_anchors_per_bio": round(statistics.mean(anchor_counts), 2),
            "has_1405_modern_fintech_pct": round(100.0 * has_modern_1405 / n, 1),
        },
        "word_counts": {
            "min": wcs[0],
            "p10": wcs[int(0.1 * n)],
            "median": int(statistics.median(wcs)),
            "mean": round(statistics.mean(wcs), 1),
            "p90": wcs[int(0.9 * n)],
            "max": wcs[-1],
            "in_ideal_100_155_pct": round(100.0 * in_ideal / n, 1),
            "under_95_pct": round(100.0 * under_95 / n, 1),
            "over_165_pct": round(100.0 * over_165 / n, 1),
        },
        "unique_voices_pct": round(100.0 * unique_voices / n, 2),
        "tags": {
            "unique_triggers": len(tr_c),
            "triggers_top5_share_pct": round(tr_top5_share, 1),
            "triggers_entropy": round(shannon_entropy(tr_c), 3),
            "unique_red_flags": len(rf_c),
            "red_flags_top5_share_pct": round(rf_top5_share, 1),
            "red_flags_entropy": round(shannon_entropy(rf_c), 3),
        },
        "logic_errors": {
            "total": total_logic_errors,
            "single_spouse": c_single_spouse,
            "owner_rent": c_owner_rent,
            "single_housewife": c_single_housewife,
            "tehran_shahrestan": c_tehran_shah,
            "poor_luxury_renter": c_poor_lux_renter,
        },
        "sub_segment_depth": sub_segments,
    }


def stratified_sample(profiles: list, k: int = 60, seed: int = 2026) -> list:
    """Deterministic stratified sample balanced by (city_tier, gender) matching each bank's proportions."""
    rng = random.Random(seed)
    groups = defaultdict(list)
    for p in profiles:
        groups[(p["city_tier"], p["gender"])].append(p)
    for g in groups.values():
        rng.shuffle(g)

    n = len(profiles)
    selected = []
    # Allocate proportionally
    remainders = []
    for key, arr in sorted(groups.items()):
        exact = k * len(arr) / n
        take = min(len(arr), int(math.floor(exact)))
        selected.extend(arr[:take])
        remainders.append((exact - take, key, arr[take:]))

    remainders.sort(key=lambda x: -x[0])
    idx = 0
    while len(selected) < k and idx < len(remainders):
        _, _, rest = remainders[idx]
        if rest:
            selected.append(rest[0])
        idx += 1

    # Fallback if still short
    if len(selected) < k:
        used_ids = {p["id"] for p in selected}
        leftover = [p for p in profiles if p["id"] not in used_ids]
        rng.shuffle(leftover)
        selected.extend(leftover[: k - len(selected)])

    return selected[:k]


def build_ad_state(ad: dict) -> str:
    return (
        f"پلتفرم نمایش تبلیغ: پست/استوری اسپانسری اینستاگرام\n"
        f"تیتر تبلیغ: {ad['headline']}\n"
        f"متن تبلیغ: {ad['body']}\n"
        f"دکمه اقدام (CTA): {ad['cta']}"
    )


def build_persona_header(p: dict) -> str:
    return (
        f"شخصیت مخاطب: {p['name']}، {p['gender']} {p['age']} ساله، ساکن {p['neighborhood']} {p['city']} ({p['city_tier']})، "
        f"شغل: {p['job']}، درآمد ماهانه: {p['monthly_income_m']} میلیون تومان ({p['income_tier']})، {p['marital_status']}، {p['housing']}. "
        f"اپلیکیشن‌ها: {'، '.join(p['platforms'])}. تیپ تبلیغی: {p['ad_archetype']} (میزان بدبینی به تبلیغات: {p['ad_skepticism']} از ۵). "
        f"شرح زندگی و تجربه واقعی: {p['life_story']}"
    )


async def eval_wave_decider(session: aiohttp.ClientSession, sem: asyncio.Semaphore, ad: dict, personas: list):
    state = build_ad_state(ad)
    questions = {}
    for p in personas:
        pre = f"{build_persona_header(p)}\n\nبا حفظ کامل شخصیت، بودجه، حوصله و سطح بدبینی این فرد ایرانی هنگام دیدن این تبلیغ در فید روزانه:"
        questions[f"{p['id']}__stop"] = {
            "type": "choice",
            "instructions": f"{pre} آیا هنگام اسکرول سریع متوقف می‌شود و این تبلیغ را می‌خواند؟ (اگر متن خیلی طولانی، کلیشه‌ای یا بی‌ربط به زندگی او باشد سریع رد می‌کند)",
            "criteria": {"yes": "مکث می‌کند و می‌خواند", "no": "بدون توجه رد می‌کند"},
        }
        questions[f"{p['id']}__click"] = {
            "type": "choice",
            "instructions": f"{pre} آیا واقعاً روی دکمه (CTA) یا لینک این تبلیغ کلیک می‌کند؟",
            "criteria": {"yes": "کلیک می‌کند", "no": "کلیک نمی‌کند"},
        }
        questions[f"{p['id']}__intent"] = {
            "type": "choice",
            "instructions": f"{pre} آیا با توجه به توان مالی، نیاز واقعی و میزان اعتمادش، حاضر به تست، ثبت‌نام یا خرید این محصول هست؟",
            "criteria": {"yes": "قصد واقعی اقدام یا خرید دارد", "no": "اقدامی نمی‌کند"},
        }
        questions[f"{p['id']}__trust"] = {
            "type": "choice",
            "instructions": f"{pre} آیا به این تبلیغ و ادعاهای آن اعتماد می‌کند (بدون شک به کلاهبرداری، هزینه‌ی پنهان، اغراق یا نقض حریم خصوصی)؟",
            "criteria": {"yes": "اعتماد می‌کند", "no": "مشکوک یا بی‌اعتماد است"},
        }
        questions[f"{p['id']}__clarity"] = {
            "type": "choice",
            "instructions": f"{pre} آیا پیام، محصول و شرایط آن برایش کاملاً شفاف و بی‌ابهام است؟",
            "criteria": {"yes": "شفاف و روشن است", "no": "مبهم یا دارای سوال بی‌پاسخ است"},
        }
        questions[f"{p['id']}__reaction"] = {
            "type": "choice",
            "instructions": f"{pre} واکنش احساسی لحظه‌ای این فرد پس از دیدن تبلیغ کدام است؟",
            "criteria": {
                "annoyed": "کلافه، بی‌اعتماد یا بی‌حوصله و ردکردنی",
                "neutral": "خنثی و بی‌تفاوت",
                "curious": "کنجکاو و علاقه‌مند به بررسی بیشتر",
                "excited": "هیجان‌زده و آماده اقدام فوری",
            },
        }

    async with sem:
        for attempt in range(3):
            try:
                async with session.post(
                    PPLX_URL,
                    headers={"Authorization": f"Bearer {PPLX_KEY}", "Content-Type": "application/json"},
                    json={"model": DECIDER_MODEL, "state": state, "questions": questions},
                    timeout=aiohttp.ClientTimeout(total=60),
                ) as resp:
                    if resp.status == 429 and attempt < 2:
                        await asyncio.sleep(1.2 * (attempt + 1))
                        continue
                    txt = await resp.text()
                    if resp.status != 200:
                        raise RuntimeError(f"Decider HTTP {resp.status}: {txt[:300]}")
                    data = json.loads(txt)
                    ans = data["answers"]
                    judgments = []
                    for p in personas:
                        pid = p["id"]
                        get_yes = lambda k: float(ans.get(f"{pid}__{k}", {}).get("probabilities", {}).get("yes", 0.0))
                        stop = get_yes("stop")
                        click = get_yes("click")
                        intent = get_yes("intent")
                        trust = get_yes("trust")
                        clarity = get_yes("clarity")
                        rx = ans.get(f"{pid}__reaction", {}).get("choice", "neutral")
                        fitness = (click * 0.35 + intent * 0.30 + trust * 0.20 + stop * 0.10 + clarity * 0.05) * 100.0
                        judgments.append({
                            "id": pid,
                            "city_tier": p["city_tier"],
                            "income_tier": p["income_tier"],
                            "ad_skepticism": p["ad_skepticism"],
                            "stop": stop,
                            "click": click,
                            "intent": intent,
                            "trust": trust,
                            "clarity": clarity,
                            "reaction": rx,
                            "fitness": fitness,
                        })
                    in_tok = int(data.get("usage", {}).get("input_tokens", 0))
                    return judgments, in_tok
            except Exception as e:
                if attempt == 2:
                    raise
                await asyncio.sleep(1.5 * (attempt + 1))


def summarize_ad_judgments(judgments: list) -> dict:
    fits = [j["fitness"] for j in judgments]
    clicks = [j["click"] * 100 for j in judgments]
    trusts = [j["trust"] * 100 for j in judgments]
    stops = [j["stop"] * 100 for j in judgments]
    intents = [j["intent"] * 100 for j in judgments]
    clarities = [j["clarity"] * 100 for j in judgments]
    rxs = Counter(j["reaction"] for j in judgments)

    low_skep = [j["fitness"] for j in judgments if j["ad_skepticism"] <= 2]
    high_skep = [j["fitness"] for j in judgments if j["ad_skepticism"] >= 4]

    # Segment spread across income tiers
    by_inc = defaultdict(list)
    for j in judgments:
        by_inc[j["income_tier"]].append(j["fitness"])
    inc_means = {k: round(statistics.mean(v), 1) for k, v in by_inc.items() if v}

    return {
        "n": len(judgments),
        "fitness_mean": round(statistics.mean(fits), 2),
        "fitness_std": round(statistics.pstdev(fits), 2),
        "fitness_iqr": round(sorted(fits)[int(0.75 * len(fits))] - sorted(fits)[int(0.25 * len(fits))], 2),
        "stop_mean": round(statistics.mean(stops), 2),
        "click_mean": round(statistics.mean(clicks), 2),
        "click_std": round(statistics.pstdev(clicks), 2),
        "intent_mean": round(statistics.mean(intents), 2),
        "trust_mean": round(statistics.mean(trusts), 2),
        "trust_std": round(statistics.pstdev(trusts), 2),
        "clarity_mean": round(statistics.mean(clarities), 2),
        "reactions": {k: rxs.get(k, 0) for k in ("annoyed", "neutral", "curious", "excited")},
        "low_skepticism_1_2_fitness": round(statistics.mean(low_skep), 2) if low_skep else None,
        "high_skepticism_4_5_fitness": round(statistics.mean(high_skep), 2) if high_skep else None,
        "skepticism_calibration_gap": round(statistics.mean(low_skep) - statistics.mean(high_skep), 2) if (low_skep and high_skep) else None,
        "income_tier_fitness": inc_means,
    }


async def run_live_decider_eval(loaded_banks: dict) -> dict:
    sem = asyncio.Semaphore(4)
    wave_size = 12
    live_results = {}
    total_tokens = 0
    t0 = time.perf_counter()

    async with aiohttp.ClientSession() as session:
        for bank_name, profiles in loaded_banks.items():
            panel = stratified_sample(profiles, k=60, seed=2026)
            bank_out = {"panel_size": len(panel), "ads": {}}

            raw_judgments = {}
            for ad_key, ad in ADS.items():
                chunks = [panel[i : i + wave_size] for i in range(0, len(panel), wave_size)]
                tasks = [eval_wave_decider(session, sem, ad, ch) for ch in chunks]
                res = await asyncio.gather(*tasks)
                judgments = []
                for js, toks in res:
                    judgments.extend(js)
                    total_tokens += toks
                raw_judgments[ad_key] = judgments
                bank_out["ads"][ad_key] = summarize_ad_judgments(judgments)
                print(
                    f"  [Decider] {bank_name:14s} | {ad_key:15s} -> "
                    f"Fitness={bank_out['ads'][ad_key]['fitness_mean']:5.2f} (±{bank_out['ads'][ad_key]['fitness_std']:4.1f}) | "
                    f"Trust={bank_out['ads'][ad_key]['trust_mean']:5.1f}% | Click={bank_out['ads'][ad_key]['click_mean']:5.1f}% | "
                    f"Rx={bank_out['ads'][ad_key]['reactions']}",
                    flush=True,
                )

            bad = bank_out["ads"]["bad_spammy"]
            solid = bank_out["ads"]["solid_realistic"]
            # Paired per-persona difference for signal-to-noise (paired Cohen's d!)
            bad_by_id = {j["id"]: j for j in raw_judgments["bad_spammy"]}
            solid_by_id = {j["id"]: j for j in raw_judgments["solid_realistic"]}
            diffs = [solid_by_id[pid]["fitness"] - bad_by_id[pid]["fitness"] for pid in solid_by_id]
            pooled_std = math.sqrt((bad["fitness_std"] ** 2 + solid["fitness_std"] ** 2) / 2.0)
            cohens_d = (solid["fitness_mean"] - bad["fitness_mean"]) / max(0.01, pooled_std)
            paired_snr = statistics.mean(diffs) / max(0.01, statistics.pstdev(diffs))
            pct_correctly_rank = 100.0 * sum(1 for d in diffs if d > 0) / max(1, len(diffs))

            bank_out["discrimination"] = {
                "fitness_gap_solid_minus_bad": round(solid["fitness_mean"] - bad["fitness_mean"], 2),
                "trust_gap_solid_minus_bad": round(solid["trust_mean"] - bad["trust_mean"], 2),
                "click_gap_solid_minus_bad": round(solid["click_mean"] - bad["click_mean"], 2),
                "cohens_d_pooled": round(cohens_d, 3),
                "paired_signal_to_noise": round(paired_snr, 3),
                "pct_personas_ranking_solid_above_bad": round(pct_correctly_rank, 1),
            }
            live_results[bank_name] = bank_out

    elapsed = time.perf_counter() - t0
    cost = total_tokens * PRICE_PER_M_INPUT / 1_000_000
    return {
        "model": DECIDER_MODEL,
        "panel_size_per_bank": 60,
        "elapsed_sec": round(elapsed, 1),
        "total_input_tokens": total_tokens,
        "cost_usd": round(cost, 6),
        "banks": live_results,
    }


def print_comparison_table(intrinsic: dict, live: dict):
    b = intrinsic["BEFORE_300"]
    r = intrinsic["RAW_1000"]
    o = intrinsic["OPTIMIZED_1000"]
    lb = live["banks"]["BEFORE_300"]
    lr = live["banks"]["RAW_1000"]
    lo = live["banks"]["OPTIMIZED_1000"]

    rows = [
        ("Total Profiles", b["count"], r["count"], o["count"]),
        ("Unique Full Names", b["unique_names"], r["unique_names"], o["unique_names"]),
        ("Provinces (of 31) / Cities / Hoods",
         f"{b['unique_provinces']} / {b['unique_cities']} / {b['unique_neighborhoods']}",
         f"{r['unique_provinces']} / {r['unique_cities']} / {r['unique_neighborhoods']}",
         f"{o['unique_provinces']} / {o['unique_cities']} / {o['unique_neighborhoods']}"),
        ("Distinct Bigram Ratio (size-matched 300)",
         f"{b['lexical_matched_300']['distinct_bigram_ratio']:.4f}",
         f"{r['lexical_matched_300']['distinct_bigram_ratio']:.4f}",
         f"{o['lexical_matched_300']['distinct_bigram_ratio']:.4f}"),
        ("Distinct Trigram Ratio (size-matched 300)",
         f"{b['lexical_matched_300']['distinct_trigram_ratio']:.4f}",
         f"{r['lexical_matched_300']['distinct_trigram_ratio']:.4f}",
         f"{o['lexical_matched_300']['distinct_trigram_ratio']:.4f}"),
        ("Opener 3-gram Entropy (size-matched 300)",
         f"{b['lexical_matched_300']['opener3_entropy']:.2f} ({b['lexical_matched_300']['opener3_unique_pct']:.1f}% uniq)",
         f"{r['lexical_matched_300']['opener3_entropy']:.2f} ({r['lexical_matched_300']['opener3_unique_pct']:.1f}% uniq)",
         f"{o['lexical_matched_300']['opener3_entropy']:.2f} ({o['lexical_matched_300']['opener3_unique_pct']:.1f}% uniq)"),
        ("Voice 2-gram Entropy (size-matched 300)",
         f"{b['lexical_matched_300']['voice2_entropy']:.2f}",
         f"{r['lexical_matched_300']['voice2_entropy']:.2f}",
         f"{o['lexical_matched_300']['voice2_entropy']:.2f}"),
        ("Cliché Profile Rate (%)",
         f"{b['cliche_profile_pct']}% ({b['cliche_profile_count']})",
         f"{r['cliche_profile_pct']}% ({r['cliche_profile_count']})",
         f"{o['cliche_profile_pct']}% ({o['cliche_profile_count']})"),
        ("Max 4-gram Corpus Share (%)",
         f"{b['max_4gram_pct']}% ({b['max_4gram_freq']}x)",
         f"{r['max_4gram_pct']}% ({r['max_4gram_freq']}x)",
         f"{o['max_4gram_pct']}% ({o['max_4gram_freq']}x)"),
        ("Bios Sharing >=2% Echo 4-gram (%)",
         f"{b['profiles_with_2pct_echo_4gram_pct']}%",
         f"{r['profiles_with_2pct_echo_4gram_pct']}%",
         f"{o['profiles_with_2pct_echo_4gram_pct']}%"),
        ("Iranian 1405 Fintech/Digital Anchors (%)",
         f"{b['grounding']['has_1405_modern_fintech_pct']}% (avg {b['grounding']['avg_iran_anchors_per_bio']})",
         f"{r['grounding']['has_1405_modern_fintech_pct']}% (avg {r['grounding']['avg_iran_anchors_per_bio']})",
         f"{o['grounding']['has_1405_modern_fintech_pct']}% (avg {o['grounding']['avg_iran_anchors_per_bio']})"),
        ("Bio Length in Ideal 100–155w (%)",
         f"{b['word_counts']['in_ideal_100_155_pct']}% (<95w: {b['word_counts']['under_95_pct']}%)",
         f"{r['word_counts']['in_ideal_100_155_pct']}% (<95w: {r['word_counts']['under_95_pct']}%)",
         f"{o['word_counts']['in_ideal_100_155_pct']}% (<95w: {o['word_counts']['under_95_pct']}%)"),
        ("Triggers / RedFlags Top-5 Concentration",
         f"{b['tags']['triggers_top5_share_pct']}% / {b['tags']['red_flags_top5_share_pct']}%",
         f"{r['tags']['triggers_top5_share_pct']}% / {r['tags']['red_flags_top5_share_pct']}%",
         f"{o['tags']['triggers_top5_share_pct']}% / {o['tags']['red_flags_top5_share_pct']}%"),
        ("Logic & Socioeconomic Errors",
         f"{b['logic_errors']['total']}",
         f"{r['logic_errors']['total']}",
         f"{o['logic_errors']['total']}"),
        ("Skepticism 1–5 Entropy",
         f"{b['skepticism_entropy']:.3f}",
         f"{r['skepticism_entropy']:.3f}",
         f"{o['skepticism_entropy']:.3f}"),
        ("Sub-segment: Women 25-40 Metro High-Inc",
         b["sub_segment_depth"]["women_25_40_metro_high_income"],
         r["sub_segment_depth"]["women_25_40_metro_high_income"],
         o["sub_segment_depth"]["women_25_40_metro_high_income"]),
        ("--- LIVE PPLX-DECIDER-V1.3 (n=60) ---", "---", "---", "---"),
        ("Bad Spammy Ad Fitness (lower=better)",
         f"{lb['ads']['bad_spammy']['fitness_mean']:.1f} (Trust {lb['ads']['bad_spammy']['trust_mean']:.1f}%)",
         f"{lr['ads']['bad_spammy']['fitness_mean']:.1f} (Trust {lr['ads']['bad_spammy']['trust_mean']:.1f}%)",
         f"{lo['ads']['bad_spammy']['fitness_mean']:.1f} (Trust {lo['ads']['bad_spammy']['trust_mean']:.1f}%)"),
        ("Solid Iranian Ad Fitness",
         f"{lb['ads']['solid_realistic']['fitness_mean']:.1f} (Trust {lb['ads']['solid_realistic']['trust_mean']:.1f}%)",
         f"{lr['ads']['solid_realistic']['fitness_mean']:.1f} (Trust {lr['ads']['solid_realistic']['trust_mean']:.1f}%)",
         f"{lo['ads']['solid_realistic']['fitness_mean']:.1f} (Trust {lo['ads']['solid_realistic']['trust_mean']:.1f}%)"),
        ("Discrimination Gap (Solid - Bad Fitness)",
         f"+{lb['discrimination']['fitness_gap_solid_minus_bad']:.2f}",
         f"+{lr['discrimination']['fitness_gap_solid_minus_bad']:.2f}",
         f"+{lo['discrimination']['fitness_gap_solid_minus_bad']:.2f}"),
        ("Trust Gap (Solid - Bad Trust %)",
         f"+{lb['discrimination']['trust_gap_solid_minus_bad']:.1f}%",
         f"+{lr['discrimination']['trust_gap_solid_minus_bad']:.1f}%",
         f"+{lo['discrimination']['trust_gap_solid_minus_bad']:.1f}%"),
        ("Signal-to-Noise (Cohen's d / Paired SNR)",
         f"{lb['discrimination']['cohens_d_pooled']:.2f} / {lb['discrimination']['paired_signal_to_noise']:.2f}",
         f"{lr['discrimination']['cohens_d_pooled']:.2f} / {lr['discrimination']['paired_signal_to_noise']:.2f}",
         f"{lo['discrimination']['cohens_d_pooled']:.2f} / {lo['discrimination']['paired_signal_to_noise']:.2f}"),
        ("% Personas Ranking Solid > Bad",
         f"{lb['discrimination']['pct_personas_ranking_solid_above_bad']:.1f}%",
         f"{lr['discrimination']['pct_personas_ranking_solid_above_bad']:.1f}%",
         f"{lo['discrimination']['pct_personas_ranking_solid_above_bad']:.1f}%"),
        ("Solid Ad Realism Spread (Std / IQR)",
         f"{lb['ads']['solid_realistic']['fitness_std']:.1f} / {lb['ads']['solid_realistic']['fitness_iqr']:.1f}",
         f"{lr['ads']['solid_realistic']['fitness_std']:.1f} / {lr['ads']['solid_realistic']['fitness_iqr']:.1f}",
         f"{lo['ads']['solid_realistic']['fitness_std']:.1f} / {lo['ads']['solid_realistic']['fitness_iqr']:.1f}"),
        ("Skepticism Calibration (Low - High Fit)",
         f"{lb['ads']['solid_realistic']['skepticism_calibration_gap']}",
         f"{lr['ads']['solid_realistic']['skepticism_calibration_gap']}",
         f"{lo['ads']['solid_realistic']['skepticism_calibration_gap']}"),
    ]

    print("\n" + "=" * 112)
    print(f"{'METRIC':<44} | {'BEFORE (300)':<20} | {'RAW-1000':<20} | {'OPTIMIZED-1000':<20}")
    print("-" * 112)
    for label, v1, v2, v3 in rows:
        print(f"{label:<44} | {str(v1):<20} | {str(v2):<20} | {str(v3):<20}")
    print("=" * 112)


async def main():
    loaded = {}
    for k, path in BANKS.items():
        with open(path, encoding="utf-8") as f:
            loaded[k] = json.load(f)["profiles"]
        print(f"Loaded {k}: {len(loaded[k])} profiles from {path}", flush=True)

    print("\n[1/2] Computing Intrinsic Quality Metrics & Size-Matched Bootstrap Diversity...", flush=True)
    intrinsic = {k: evaluate_intrinsic(k, ps) for k, ps in loaded.items()}

    print("\n[2/2] Running Live Behavioral Evaluation on pplx-decider-v1.3 (60 stratified personas x 2 ads x 3 banks)...", flush=True)
    live = await run_live_decider_eval(loaded)

    # Load cost metadata from scaling & optimization steps if available
    costs = {}
    scale_meta = DATA_DIR / "scale_crowd_stats.json"
    opt_meta = DATA_DIR / "optimize_crowd_report.json"
    if scale_meta.exists():
        costs["scale_1000_usd"] = json.load(open(scale_meta))["cost_usd"]
    if opt_meta.exists():
        costs["optimize_passes_usd"] = json.load(open(opt_meta))["cost_usd"]
    costs["live_decider_eval_usd"] = live["cost_usd"]
    costs["total_usd"] = round(sum(costs.values()), 4)

    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "ads_tested": ADS,
        "intrinsic": intrinsic,
        "live_behavioral": live,
        "api_costs_usd": costs,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print_comparison_table(intrinsic, live)
    print(f"\nSaved full evaluation report to: {OUT_JSON}")
    print(f"API Costs Breakdown: {costs}")


if __name__ == "__main__":
    asyncio.run(main())
