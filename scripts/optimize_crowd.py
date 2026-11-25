#!/usr/bin/env python3
"""
Crowd (مردم) — Step 4: Programmatic Audit + Targeted De-Cliché & Deepening Optimization Pass
Audits all 1,000 profiles in `data/iran_crowd_raw_1000.json`, scores every profile transparently
(0..100), identifies the bottom 350 most repetitive / cliché / flawed / short-or-bloated profiles,
and runs a surgical DeepSeek-Flash De-Cliché & Deepening Rewrite Pass with per-profile flaw
diagnostics, banned echoed 4-grams, fresh 1405 Iranian micro-scenarios, and a strict acceptance gate.

Outputs:
  - data/iran_crowd.json              (Final polished 1,000-profile bank)
  - data/optimize_crowd_report.json   (Before-opt vs After-opt audit summary)
"""

import asyncio
import json
import math
import os
import random
import re
import time
from collections import Counter
from pathlib import Path
import aiohttp

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_FILE = DATA_DIR / "iran_crowd_raw_1000.json"
FINAL_FILE = DATA_DIR / "iran_crowd.json"
REPORT_FILE = DATA_DIR / "optimize_crowd_report.json"

for line in open(ROOT / ".env", encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ[k] = v

DEEPSEEK_KEY = os.environ["DEEPSEEK_API_KEY"]

# Strict Persona schema fields from src/lib/types.ts
VALID_CITY_TIERS = {"تهران", "کلان‌شهر", "مرکز استان", "شهرستان"}
VALID_INCOME_TIERS = {"کم‌درآمد", "متوسط رو به پایین", "متوسط", "متوسط رو به بالا", "مرفه"}
VALID_GENDERS = {"زن", "مرد"}
KEEP_EXACT_HOODS = {"خانه اصفهان"}

CLICHE_PHRASES = [
    "از آن روز",
    "از آن موقع",
    "از آن به بعد",
    "از اون روز",
    "از اون موقع",
    "از اون به بعد",
    "ساعت مچی",
    "پکیج درآمد",
    "درآمد اینترنتی",
    "یک بار از یک پیج",
    "یه بار از یه پیج",
    "بچه‌ها یه پیج",
    "پشتیبانی گوشی را قطع",
    "فقط تا امشب",
    "فرصت طلایی",
]

IRAN_ANCHORS = [
    "دیجی‌کالا", "ترب", "باسلام", "دیوار", "اسنپ", "اسنپ‌پی", "دیجی‌پی", "تارا",
    "بلوبانک", "ویپاد", "طلاین", "طلاسی", "طلا", "تتر", "نوبیتکس", "اینماد", "شاپرک",
    "ایتا", "روبیکا", "بله", "تلگرام", "اینستاگرام", "فیلترشکن", "تیپاکس", "کافه‌بازار",
    "شاد", "صیادی", "کالابرگ", "تومان", "میلیون", "تومن", "پست", "پیک", "تپسی", "بانک",
]

# 40 completely fresh, vivid 1405 Iranian everyday micro-scenarios for the rewrite pass!
FRESH_SCENARIOS = [
    "انتظار در صف معاینه فنی خودرو یا تعمیرگاه محله و مرور هزینه‌های نگهداری ماشین در سال ۱۴۰۵",
    "نشستن در مترو یا اتوبوس بی‌آرتی سر صبح و اسکرول سریع گوشی میان دو ایستگاه",
    "پنجشنبه‌شب دورهمی خانوادگی وقتی یکی از فامیل‌ها درباره خرید آنلاین یا قسط جدیدش تعریف می‌کند",
    "حساب‌وکتاب خریدهای ماهانه در سوپرمارکت یا فروشگاه زنجیره‌ای محله (مثل افق کوروش یا جانبو) و مقایسه قیمت‌ها",
    "چک کردن گروه اولیا و مربیان یا گروه همکاران در پیام‌رسان و رد و بدل کردن لینک و تجربه خرید",
    "استراحت کوتاه ظهر با یک لیوان چای و بررسی قیمت کالا یا خدمات مورد نیاز در موبایل",
    "پیاده‌روی عصرگاهی در خیابان‌های محله و مقایسه قیمت مغازه‌های محلی با فروشگاه‌های آنلاین",
    "مرتب کردن فاکتورها، رسیدهای کارت‌به‌کارت و قسط‌های ماهانه روی گوشی آخر هفته",
    "دغدغه تعمیر وسایل خانه مثل پکیج، کولر یا ماشین لباسشویی و ترس از هزینه قطعه تقلبی",
    "درگیر بودن با نوبت دکتر یا دندانپزشکی و مدیریت هزینه‌های درمان با بیمه تکمیلی",
    "خریدن هدیه تولد یا سکه پارسیان برای یک مناسبت خانوادگی با بودجه مشخص",
    "نشستن در یک کافه محلی یا پشت میز کار و بررسی ابزارها و سرویس‌های کاربردی برای کار روزمره",
    "آماده شدن برای یک سفر کوتاه جاده‌ای یا رزرو بلیط قطار/اقامتگاه بوم‌گردی و مقایسه سایت‌ها",
    "چرخیدن در بازار سنتی یا پاساژ محله برای لمس جنس قبل از تصمیم به سفارش اینترنتی",
    "گفتگو با یکی از دوستان صمیمی درباره اینکه کدام برندها واقعاً ارزش پول دادن دارند و کدام‌ها فقط تبلیغند",
    "دغدغه خرید لباس فصل یا کفش باکیفیت برای خود یا خانواده بدون افتادن در دام حراج‌های صوری",
    "بررسی مشخصات فنی یک گوشی، لپ‌تاپ یا گجت دست‌دوم و نو برای کار یا درس",
    "دغدغه ورزش، سلامت جسم یا رژیم غذایی وسط مشغله روزمره و هزینه بالای باشگاه‌ها",
    "پیگیری وضعیت اینترنت همراه، بسته دیتا و دردسر کندی سایت‌های سنگین روی موبایل",
    "مدیریت هزینه‌های قبض برق، گاز، شارژ ساختمان و خرید اقلام عمده برای صرفه‌جویی",
    "تلاش برای یادگیری یک مهارت جدید آنلاین (زبان، نرم‌افزار یا حرفه فنی) بدون خرید دوره‌های توخالی",
    "خرید لوازم تحریر، کتاب یا ملزومات درسی/کاری و حساسیت به کیفیت واقعی و ارسال به‌موقع",
    "نگهداری از خودرو، خرید لاستیک یا روغن موتور و مقایسه قیمت بازار با فروشگاه‌های اینترنتی",
    "پیدا کردن یک خدمت مطمئن خانگی (نظافت، نصب، تعمیرات یا آموزش) بدون معطلی و بدقولی",
    "مقایسه خرید مستقیم از تولیدکننده و کارگاه‌های کوچک با برندهای گران‌قیمت تبلیغاتی",
    "بررسی سبد پس‌انداز خرد (طلا، صندوق یا ارز) در برابر وسوسه خرج‌های لحظه‌ای",
    "سفارش دادن غذا، قهوه یا ملزومات روزمره در روزهای شلوغ کاری وقتی فرصت آشپزی یا خرید حضوری نیست",
    "چک کردن کد اصالت، گارانتی شرکتی و آدرس دفتر مرکزی قبل از اعتماد به یک اسم تازه‌کار",
    "تجربه خرید یک کالای ایرانی باکیفیت که نظرش را نسبت به برندهای بومی مثبت‌تر کرده",
    "بیزاری از تماس‌های تبلیغاتی ناخواسته و پیامک‌های انبوه؛ ترجیح تحقیق مستقل و بی‌سر‌و‌صدا",
    "وقت گذاشتن در آخر هفته برای تمیزکاری، بازسازی کوچک خانه یا خرید لوازم دکوراسیون کاربردی",
    "بررسی شرایط مرجوعی و گارانتی کتبی قبل از خرید وسایل برقی یا دیجیتال گران‌قیمت",
    "کمک کردن به پدر و مادر یا اطرافیان برای تشخیص تبلیغات واقعی از لینک‌های مشکوک و کلاهبرداری",
    "تلاش برای مدیریت زمان بین کار اصلی و یک پروژه یا شغل دوم برای جبران تورم ۱۴۰۵",
    "دنبال کردن نقدهای ویدیویی مستقل و آنباکسینگ واقعی به جای تبلیغات پرزرق‌وبرق اینفلوئنسرها",
    "بررسی کیفیت بسته‌بندی، تاریخ انقضا و اصالت محصولات آرایشی، بهداشتی یا خوراکی",
    "تجربه استفاده از کیف‌پول‌های اعتباری و خرید اقساطی با بررسی دقیق کارمزد و تاریخ سررسید",
    "مقایسه تجربه خرید از فروشگاه‌های معتبر دارای اینماد با پیج‌های بدون شماره تلفن ثابت",
    "حساسیت به فارسیِ درست، لحن محترمانه و صادقانه در تبلیغات و بیزاری از تیترهای هیجانی زرد",
    "اولویت دادن به دوام و خدمات پس از فروش واقعی به جای ظاهر فریبنده و قیمت بیش‌ازحد ارزان",
]

FRESH_VOICE_OPENERS = [
    "شروع با یک سوال کوتاه و صریح متناسب با شغل و شخصیت فرد (از هیچ الگوی تکراری استفاده نکن)",
    "شروع با یک شرط واقعی و عملی برای اعتماد یا خرید به زبان محاوره طبیعی",
    "شروع با واکنش احساسی زنده و محاوره‌ای (شوخی، کنایه، تعجب یا خستگی واقعی روزمره)",
    "شروع با اشاره مستقیم به یک عدد، مقایسه یا جزئیات کالا/خدمت",
    "شروع کوتاه و خودمانی با لحن سن و شهر این شخص بدون تکرار «من تا» یا «این تبلیغ»",
]


def clean_neighborhood(city: str, hood: str) -> str:
    h = hood.strip()
    if h in KEEP_EXACT_HOODS:
        return h
    suffix = " " + city
    if h.endswith(suffix):
        stripped = h[: -len(suffix)].strip()
        if len(stripped) >= 3 and stripped not in {"بلوار", "خیابان", "میدان", "شهرک", "مسکن", "فاز"}:
            return stripped
    return h


def extract_4grams(text: str) -> set:
    toks = text.split()
    return {" ".join(toks[i : i + 4]) for i in range(max(0, len(toks) - 3))}


def compute_corpus_stats(profiles: list) -> dict:
    ngram_df = Counter()
    opener3_df = Counter()
    voice2_df = Counter()
    trigger_df = Counter()
    redflag_df = Counter()

    for p in profiles:
        ls = p["life_story"]
        for g in extract_4grams(ls):
            ngram_df[g] += 1
        toks = ls.split()
        if len(toks) >= 3:
            opener3_df[" ".join(toks[:3])] += 1
        vtoks = p["voice_sample"].split()
        if len(vtoks) >= 2:
            voice2_df[" ".join(vtoks[:2])] += 1
        for t in p.get("triggers", []):
            trigger_df[t.strip()] += 1
        for r in p.get("red_flags", []):
            redflag_df[r.strip()] += 1

    return {
        "ngram_df": ngram_df,
        "opener3_df": opener3_df,
        "voice2_df": voice2_df,
        "trigger_df": trigger_df,
        "redflag_df": redflag_df,
    }


def detect_contradictions(p: dict) -> list:
    issues = []
    ls = p["life_story"]
    if p["marital_status"] == "مجرد":
        spouse_words = ["شوهرم", "همسرم", "زن و بچه", "خانمم", "بچه‌هام", "فرزندانم", "دخترم", "پسرم", "عیالم"]
        found = [w for w in spouse_words if w in ls]
        if found:
            issues.append(f"تناقض تاهل: فرد مجرد است ولی از «{found[0]}» صحبت کرده")

    if p["housing"] == "مالک":
        if re.search(r"(?:اجاره[\u200c ]?(?:خانه|خونه|آپارتمان|مسکن|ماهی|ماهانه)?\s*(?:می‌دهم|می‌دم|بدم|بدهم|سنگین|بالا|دارم)|صاحبخانه|صاحبخونه|تمدید اجاره‌?نامه|اجاره‌نشین)", ls):
            issues.append("تناقض مسکن: فرد مالک خانه است ولی از پرداخت اجاره مسکن یا صاحبخانه گفته")

    if p["city"] == "تهران":
        if any("شهرستان" in t for t in p.get("triggers", [])) or "ارسال به شهرستان" in ls:
            issues.append("تناقض جغرافیا: ساکن تهران است ولی ارسال به شهرستان نوشته")

    if p["job"].startswith("خانه‌دار") and p["marital_status"] == "مجرد":
        issues.append("تناقض شغلی: خانه‌دار و مجرد")

    return issues


def audit_profile(p: dict, cstats: dict) -> dict:
    """Computes transparent 0..100 quality_score and returns structured flaws to fix."""
    ls = p["life_story"]
    vs = p["voice_sample"]
    words = ls.split()
    wc = len(words)
    flaws = []
    banned_local = []

    # 1. Length discipline (0..18)
    if 105 <= wc <= 155:
        s_len = 18.0
    elif 95 <= wc < 105 or 155 < wc <= 168:
        s_len = 12.0
        flaws.append(f"طول متن ایده‌آل نیست ({wc} کلمه؛ هدف دقیق ۱۱۵ تا ۱۴۵ کلمه)")
    else:
        s_len = 2.0
        flaws.append(f"طول متن خارج از محدوده استاندارد است ({wc} کلمه؛ باید دقیقاً ۱۱۵ تا ۱۴۵ کلمه باشد)")

    # 2. Anti-Seed-Echo 4-gram uniqueness (0..25)
    p_4grams = extract_4grams(ls)
    echo_hits = sorted(
        [(g, cstats["ngram_df"][g]) for g in p_4grams if cstats["ngram_df"][g] >= 12],
        key=lambda x: -x[1],
    )
    # Deduplicate overlapping 4-grams for readable flaw reporting
    distinct_echoes = []
    for g, cnt in echo_hits:
        if not any(g in prev or prev in g for prev, _ in distinct_echoes):
            distinct_echoes.append((g, cnt))
    echo_penalty = min(25.0, sum(4.5 if cnt >= 40 else (3.0 if cnt >= 20 else 1.8) for _, cnt in distinct_echoes))
    s_echo = max(0.0, 25.0 - echo_penalty)
    if distinct_echoes:
        top_e = [g for g, _ in distinct_echoes[:5]]
        banned_local.extend(top_e)
        flaws.append(f"تکرار عبارات قالبی در بانک ({len(distinct_echoes)} مورد مثل: «{'»، «'.join(top_e[:3])}»)")

    # 3. Anti-Cliché & Opener/Voice Diversity (0..18)
    s_cliche = 18.0
    found_cliches = [c for c in CLICHE_PHRASES if c in ls]
    if found_cliches:
        s_cliche -= min(10.0, 5.0 * len(found_cliches))
        banned_local.extend(found_cliches)
        flaws.append(f"وجود عبارت کلیشه‌ای ممنوعه: «{'»، «'.join(found_cliches)}»")

    op3 = " ".join(words[:3]) if len(words) >= 3 else ""
    op3_cnt = cstats["opener3_df"].get(op3, 1)
    if op3_cnt >= 6 or ls.startswith("صبح‌ها"):
        s_cliche -= 4.5
        banned_local.append(op3)
        flaws.append(f"شروع تکراری در بانک ({op3_cnt} بار تکرار شده): «{op3}»")

    vtoks = vs.split()
    vop2 = " ".join(vtoks[:2]) if len(vtoks) >= 2 else ""
    vop2_cnt = cstats["voice2_df"].get(vop2, 1)
    if vop2_cnt >= 12 or len(vtoks) < 6:
        s_cliche -= 3.5
        if vop2:
            banned_local.append(vop2)
        flaws.append(f"شروع یا ساختار جمله صوتی (voice_sample) تکراری است: «{vop2}» ({vop2_cnt} بار)")
    s_cliche = max(0.0, s_cliche)

    # 4. Concrete Iranian Grounding (0..15)
    has_num = bool(re.search(r"[0-9۰-۹]+|میلیون|هزار|تومان|تومن", ls))
    has_loc = (p["city"] in ls) or (p["neighborhood"] in ls)
    anchor_hits = sum(1 for a in IRAN_ANCHORS if a in ls)
    s_ground = (5.0 if has_num else 0.0) + (4.0 if has_loc else 0.0) + min(6.0, anchor_hits * 1.5)
    if not has_num:
        flaws.append("فاقد عدد مشخص تومانی/مالی ملموس")
    if not has_loc:
        flaws.append(f"اشاره طبیعی به محله «{p['neighborhood']}» یا شهر «{p['city']}» ندارد")
    if anchor_hits < 3:
        flaws.append("لنگرهای واقعی زیست دیجیتال/مالی ایران ۱۴۰۵ کم است")

    # 5. Tag Originality (0..12)
    tr_scores = [cstats["trigger_df"].get(t.strip(), 1) for t in p.get("triggers", [])]
    rf_scores = [cstats["redflag_df"].get(r.strip(), 1) for r in p.get("red_flags", [])]
    overused_tags = [
        t for t in p.get("triggers", []) if cstats["trigger_df"].get(t.strip(), 1) >= 25
    ] + [
        r for r in p.get("red_flags", []) if cstats["redflag_df"].get(r.strip(), 1) >= 25
    ]
    s_tags = max(0.0, 12.0 - 2.2 * len(overused_tags))
    if len(p.get("triggers", [])) < 3 or len(p.get("red_flags", [])) < 3:
        s_tags = max(0.0, s_tags - 3.0)
        flaws.append("تعداد triggers یا red_flags کمتر از ۳ است")
    if overused_tags:
        flaws.append(f"تگ‌های بیش‌ازحد تکراری: {', '.join(overused_tags[:4])}")

    # 6. Logical Consistency (0..12)
    contradictions = detect_contradictions(p)
    s_cons = 0.0 if contradictions else 12.0
    flaws.extend(contradictions)

    total = round(s_len + s_echo + s_cliche + s_ground + s_tags + s_cons, 2)
    hard_fail = bool(contradictions) or wc < 95 or wc > 168

    return {
        "id": p["id"],
        "score": total,
        "hard_fail": hard_fail,
        "wc": wc,
        "echo_count": len(distinct_echoes),
        "cliche_count": len(found_cliches),
        "contradictions": contradictions,
        "flaws": flaws,
        "banned_local": list(dict.fromkeys(b for b in banned_local if b)),
        "subscores": {
            "length": round(s_len, 1),
            "echo_uniqueness": round(s_echo, 1),
            "anti_cliche": round(s_cliche, 1),
            "grounding": round(s_ground, 1),
            "tag_originality": round(s_tags, 1),
            "consistency": round(s_cons, 1),
        },
    }


async def rewrite_batch(
    session: aiohttp.ClientSession,
    sem: asyncio.Semaphore,
    batch_items: list,
    batch_idx: int,
    total_batches: int,
    global_top_echoes: list,
    rng: random.Random,
):
    payload_profiles = []
    for p, audit in batch_items:
        fresh_scene = rng.choice(FRESH_SCENARIOS)
        fresh_voice = rng.choice(FRESH_VOICE_OPENERS)
        is_tehran = p["city"] == "تهران"
        rules = []
        if p["marital_status"] == "مجرد":
            rules.append("مجرد است — مطلقاً هیچ اشاره‌ای به همسر، شوهر، خانم یا فرزند نکن!")
        if p["housing"] == "مالک":
            rules.append("مالک خانه است — مطلقاً از پرداخت اجاره خانه یا صاحبخانه حرف نزن!")
        if is_tehran:
            rules.append("ساکن تهران است — از «ارسال شهرستان» حرف نزن!")

        payload_profiles.append({
            "id": p["id"],
            "identity": f"{p['name']} ({p['gender']} {p['age']} ساله، محله {p['neighborhood']} در {p['city']} - {p['province']}، شغل: {p['job']}، درآمد ۱۴۰۵: {p['monthly_income_m']} میلیون تومان [{p['income_tier']}]، {p['marital_status']}، {p['housing']}، اپ‌ها: {'، '.join(p['platforms'])}، تیپ: {p['ad_archetype']}، بدبینی: {p['ad_skepticism']} از ۵)",
            "consistency_rules": " | ".join(rules) if rules else "انسجام کامل با سن، شهر، شغل و درآمد حفظ شود.",
            "detected_flaws_to_fix": audit["flaws"],
            "banned_phrases_for_this_person": audit["banned_local"][:8],
            "fresh_1405_scene": fresh_scene,
            "voice_style_hint": fresh_voice,
        })

    global_ban_str = "»، «".join(global_top_echoes[:14])

    prompt = f"""تو سردبیر ارشد پژوهش بازار ایران و نویسنده نثر فوق‌طبیعی فارسی در سال ۱۴۰۵ هستی.
مأموریت تو: **بازنویسی کامل، عمیق و کاملاً غیرکلیشه‌ای** این {len(batch_items)} پروفایل است تا تمام ایرادهای شناسایی‌شده (`detected_flaws_to_fix`) برطرف شود و هر پروفایل مثل یک انسان یکتا و واقعی ایرانی نفس بکشد!

⛔ فهرست سیاه مطلق (این عبارات پرتکرار را در هیچ پروفایلی نیاور!):
«{global_ban_str}»، «از آن روز»، «از آن موقع»، «از آن به بعد»، «از اون موقع»، «از اون روز»، «یک بار از یک پیج»، «بچه‌ها یه پیج»، «ساعت مچی»، «پکیج درآمد»، «سر برج که»، «شب‌ها بعد از»، «صبح‌ها»، «من تا»، «من وقت»، «این تبلیغ».
همچنین هر پروفایل یک `banned_phrases_for_this_person` دارد که آن عبارات هم برایش کاملاً ممنوع است!

✅ استانداردهای الزامی بازنویسی:
1) `life_story`: **دقیقاً بین ۱۱۵ تا ۱۴۵ کلمه فارسی** (کوتاه‌تر از ۱۱۰ یا بلندتر از ۱۵۵ نشود!).
   - صحنه تازه `fresh_1405_scene` را به‌شکل زنده و کاملاً شخصی‌سازی‌شده با شغل، محله ({payload_profiles[0]['id']} و بقیه)، درآمد تومانی ۱۴۰۵ و اپ‌های واقعی خودش بباف.
   - یک عدد تومانی ملموس + نام محله یا شهر خودش + حداقل ۳ لنگر واقعی زیست ۱۴۰۵ ایران (مثل دیجی‌کالا، ترب، باسلام، اسنپ‌پی، دیجی‌پی، تارا، بلوبانک، ویپاد، طلاین، اینماد، شاپرک، ایتا، روبیکا، بله، دیوار، فیلترشکن، تیپاکس، چک صیادی، کالابرگ و...) را طبیعی (نه فهرست‌وار!) در متن بیاور.
   - دقیقاً مشخص باشد هنگام دیدن تبلیغ چه چیزی متوقفش می‌کند و چه چیزی فوراً ردش می‌کند — متناسب با سطح بدبینی خودش (`۱` و `۲` کنجکاو و گشوده‌تر، `۴` و `۵` محتاط‌تر).
   - انسجام ۱۰۰٪ با `consistency_rules`!
2) `voice_sample`: یک جمله محاوره‌ای فوق‌طبیعی (۱۰ تا ۲۰ کلمه) با پیروی از `voice_style_hint` — اصلاً با «من تا»، «من وقت»، «این تبلیغ» یا «قبل از» شروع نشود!
3) `triggers`: دقیقاً ۳ تگ کوتاه، تازه و اختصاصی (۲ تا ۴ کلمه) — از تگ‌های تکراری مثل «بسته‌بندی تمیز»، «تخفیف واقعی»، «پشتیبانی صادقانه»، «قیمت شفاف» دوری کن و تگ‌های دقیق‌تر و خاصِ همین آدم بساز!
4) `red_flags`: دقیقاً ۳ تگ کوتاه، تازه و اختصاصی (۲ تا ۴ کلمه) — از تگ‌های تکراری مثل «کلیک‌بیت»، «فروشنده ناشناس»، «بنر شلوغ»، «درخواست کد ملی» دوری کن و خط‌قرمزهای دقیق‌تر همین آدم را بنویس!

پروفایل‌ها برای بازنویسی عمیق:
{json.dumps(payload_profiles, ensure_ascii=False)}

خروجی را دقیقاً به صورت JSON با کلید `profiles` برگردان:
{{"profiles": [{{"id": "...", "life_story": "...", "voice_sample": "...", "triggers": ["...", "...", "..."], "red_flags": ["...", "...", "..."]}}]}}"""

    async with sem:
        for attempt in range(4):
            t0 = time.perf_counter()
            try:
                async with session.post(
                    "https://api.deepseek.com/chat/completions",
                    headers={"Authorization": f"Bearer {DEEPSEEK_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": "deepseek-flash",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 5000,
                        "temperature": 0.94,
                        "thinking": {"type": "disabled"},
                        "response_format": {"type": "json_object"},
                    },
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as resp:
                    text = await resp.text()
                    if resp.status == 429:
                        await asyncio.sleep(3 * (attempt + 1))
                        continue
                    if resp.status != 200:
                        raise RuntimeError(f"HTTP {resp.status}: {text[:300]}")
                    data = json.loads(text)
                    parsed = json.loads(data["choices"][0]["message"]["content"])
                    items = {}
                    for item in parsed.get("profiles", []):
                        pid = item.get("id")
                        ls = re.sub(r"\s+", " ", str(item.get("life_story") or "")).strip()
                        vs = re.sub(r"\s+", " ", str(item.get("voice_sample") or "")).strip().strip("«»\"'")
                        tr = [str(t).strip() for t in (item.get("triggers") or []) if str(t).strip()][:3]
                        rf = [str(r).strip() for r in (item.get("red_flags") or []) if str(r).strip()][:3]
                        if pid and 90 <= len(ls.split()) <= 170 and len(vs.split()) >= 5 and len(tr) == 3 and len(rf) == 3:
                            items[pid] = {
                                "id": pid,
                                "life_story": ls,
                                "voice_sample": vs,
                                "triggers": tr,
                                "red_flags": rf,
                            }
                    if len(items) < len(batch_items):
                        raise ValueError(f"Only {len(items)}/{len(batch_items)} valid rewrites")
                    ms = round((time.perf_counter() - t0) * 1000)
                    usage = data.get("usage", {})
                    if (batch_idx + 1) % 10 == 0 or batch_idx == 0 or batch_idx + 1 == total_batches:
                        print(f"  Rewrite batch {batch_idx+1:02d}/{total_batches} OK ({len(items)} profiles, {ms}ms, {usage.get('completion_tokens', 0)} out_tok)", flush=True)
                    return items, usage
            except Exception as e:
                print(f"  Rewrite batch {batch_idx+1:02d}/{total_batches} attempt {attempt+1} error: {e}", flush=True)
                await asyncio.sleep(2.5 * (attempt + 1))
        raise RuntimeError(f"Rewrite batch {batch_idx+1} failed after 4 retries")


def validate_schema(profiles: list):
    required_keys = [
        "id", "name", "gender", "age", "province", "city", "neighborhood", "city_tier",
        "job", "sector", "monthly_income_m", "income_tier", "marital_status", "housing",
        "platforms", "payment_habit", "ad_archetype", "ad_skepticism", "avatar_hue",
        "life_story", "voice_sample", "triggers", "red_flags",
    ]
    seen_ids = set()
    seen_names = set()
    for p in profiles:
        for k in required_keys:
            assert k in p, f"Missing key {k} in {p.get('id')}"
        assert p["id"] not in seen_ids, f"Duplicate id {p['id']}"
        seen_ids.add(p["id"])
        assert p["name"] not in seen_names, f"Duplicate name {p['name']}"
        seen_names.add(p["name"])
        assert p["gender"] in VALID_GENDERS, f"Invalid gender {p['gender']}"
        assert p["city_tier"] in VALID_CITY_TIERS, f"Invalid city_tier {p['city_tier']}"
        assert p["income_tier"] in VALID_INCOME_TIERS, f"Invalid income_tier {p['income_tier']}"
        assert isinstance(p["age"], int) and 18 <= p["age"] <= 80
        assert isinstance(p["monthly_income_m"], (int, float)) and p["monthly_income_m"] > 0
        assert isinstance(p["ad_skepticism"], int) and 1 <= p["ad_skepticism"] <= 5
        assert isinstance(p["platforms"], list) and len(p["platforms"]) >= 2
        assert isinstance(p["triggers"], list) and len(p["triggers"]) >= 2
        assert isinstance(p["red_flags"], list) and len(p["red_flags"]) >= 2
        assert len(p["life_story"].strip()) > 100
        assert len(p["voice_sample"].strip()) > 10


async def main():
    import sys
    polish_mode = "--polish" in sys.argv
    t0 = time.perf_counter()
    rng = random.Random(140599 if not polish_mode else 140622)

    src_file = FINAL_FILE if polish_mode else RAW_FILE
    with open(src_file, encoding="utf-8") as f:
        raw_doc = json.load(f)
    profiles = raw_doc["profiles"]
    print(f"Loaded {len(profiles)} profiles from {src_file} (polish_mode={polish_mode})", flush=True)

    # Also keep RAW-1000 baseline stats if polish_mode so report reflects full RAW -> FINAL delta!
    prev_report = {}
    if polish_mode and REPORT_FILE.exists():
        with open(REPORT_FILE, encoding="utf-8") as f:
            prev_report = json.load(f)

    # Phase 1: Deterministic Neighborhood Normalization (fixes redundant "فین کاشان کاشان" display!)
    hoods_cleaned = 0
    for p in profiles:
        old_h = p["neighborhood"]
        new_h = clean_neighborhood(p["city"], old_h)
        if new_h != old_h:
            p["neighborhood"] = new_h
            hoods_cleaned += 1
    if hoods_cleaned:
        print(f"Phase 1: Cleaned {hoods_cleaned} redundant city suffixes from neighborhood labels.", flush=True)

    # Phase 2: Programmatic Audit
    cstats_before = compute_corpus_stats(profiles)
    audits_before = [audit_profile(p, cstats_before) for p in profiles]
    audit_map_before = {a["id"]: a for a in audits_before}

    avg_score_before = sum(a["score"] for a in audits_before) / len(audits_before)
    hard_fails_before = sum(1 for a in audits_before if a["hard_fail"])
    contradictions_before = sum(1 for a in audits_before if a["contradictions"])
    short_before = sum(1 for a in audits_before if a["wc"] < 95)
    long_before = sum(1 for a in audits_before if a["wc"] > 168)
    cliche_profiles_before = sum(1 for a in audits_before if a["cliche_count"] > 0)
    top_echoes_before = [g for g, c in cstats_before["ngram_df"].most_common(25) if c >= 18]

    print(f"\nPhase 2 (Current Audit):", flush=True)
    print(f"  Avg quality_score: {avg_score_before:.2f}/100 | Hard fails: {hard_fails_before} (contradictions={contradictions_before}, <95w={short_before}, >168w={long_before})", flush=True)
    print(f"  Profiles with cliché phrases: {cliche_profiles_before}/1000", flush=True)
    print(f"  Top 5 echoed 4-grams: {cstats_before['ngram_df'].most_common(5)}", flush=True)

    # Select profiles to rewrite
    target_n = 150 if polish_mode else 350
    ranked = sorted(
        profiles,
        key=lambda p: (
            0 if audit_map_before[p["id"]]["hard_fail"] else (1 if audit_map_before[p["id"]]["cliche_count"] > 0 else 2),
            audit_map_before[p["id"]]["score"],
        ),
    )
    to_rewrite = ranked[:target_n]
    cutoff_score = audit_map_before[to_rewrite[-1]["id"]]["score"]
    print(f"\nPhase 3: Selecting {len(to_rewrite)} profiles for DeepSeek-Flash De-Cliché & Deepening Pass (last score={cutoff_score:.2f})...", flush=True)

    batch_size = 7
    batches = [
        [(p, audit_map_before[p["id"]]) for p in to_rewrite[i : i + batch_size]]
        for i in range(0, len(to_rewrite), batch_size)
    ]

    sem = asyncio.Semaphore(14)
    total_in = 0
    total_out = 0
    rewritten_map = {}

    connector = aiohttp.TCPConnector(limit=20)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [
            rewrite_batch(session, sem, b, idx, len(batches), top_echoes_before, random.Random(1405 + idx))
            for idx, b in enumerate(batches)
        ]
        results = await asyncio.gather(*tasks)
        for items, usage in results:
            rewritten_map.update(items)
            total_in += usage.get("prompt_tokens", 0)
            total_out += usage.get("completion_tokens", 0)

    # Apply rewrites with acceptance check & identify any stragglers that still have hard fails
    accepted = 0
    reverted = 0
    by_id = {p["id"]: p for p in profiles}
    candidates = []
    for p in profiles:
        pid = p["id"]
        if pid in rewritten_map:
            rw = rewritten_map[pid]
            cand = {
                **p,
                "life_story": rw["life_story"],
                "voice_sample": rw["voice_sample"],
                "triggers": rw["triggers"],
                "red_flags": rw["red_flags"],
            }
            candidates.append(cand)
        else:
            candidates.append(p)

    # Recompute corpus stats on candidate corpus to check actual score improvement & stragglers
    cstats_mid = compute_corpus_stats(candidates)
    stragglers = []
    final_profiles = []
    for orig, cand in zip(profiles, candidates):
        pid = orig["id"]
        if pid not in rewritten_map:
            final_profiles.append(orig)
            continue
        a_orig = audit_profile(orig, cstats_before)
        a_cand = audit_profile(cand, cstats_mid)
        if a_cand["hard_fail"] or a_cand["cliche_count"] > 0:
            stragglers.append((cand, a_cand))
            final_profiles.append(cand)
        elif a_cand["score"] >= a_orig["score"] - 1.5 or a_orig["hard_fail"]:
            accepted += 1
            final_profiles.append(cand)
        else:
            reverted += 1
            final_profiles.append(orig)

    # Micro-polish pass for any stragglers (guarantees near-zero hard fails & clichés!)
    if stragglers:
        print(f"\nPhase 3b: Micro-polishing {len(stragglers)} stragglers with remaining hard flaws or clichés...", flush=True)
        top_echoes_mid = [g for g, c in cstats_mid["ngram_df"].most_common(25) if c >= 18]
        s_batches = [stragglers[i : i + batch_size] for i in range(0, len(stragglers), batch_size)]
        s_rewritten = {}
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit=16)) as session:
            tasks = [
                rewrite_batch(session, sem, b, idx, len(s_batches), top_echoes_mid, random.Random(9900 + idx))
                for idx, b in enumerate(s_batches)
            ]
            s_results = await asyncio.gather(*tasks)
            for items, usage in s_results:
                s_rewritten.update(items)
                total_in += usage.get("prompt_tokens", 0)
                total_out += usage.get("completion_tokens", 0)

        for idx, p in enumerate(final_profiles):
            if p["id"] in s_rewritten:
                rw = s_rewritten[p["id"]]
                cand2 = {
                    **p,
                    "life_story": rw["life_story"],
                    "voice_sample": rw["voice_sample"],
                    "triggers": rw["triggers"],
                    "red_flags": rw["red_flags"],
                }
                if not detect_contradictions(cand2):
                    final_profiles[idx] = cand2
                    accepted += 1

    # Validate 100% conformance with src/lib/types.ts Persona schema
    validate_schema(final_profiles)

    # Final audit on OPTIMIZED-1000
    cstats_after = compute_corpus_stats(final_profiles)
    audits_after = [audit_profile(p, cstats_after) for p in final_profiles]
    avg_score_after = sum(a["score"] for a in audits_after) / len(audits_after)
    hard_fails_after = sum(1 for a in audits_after if a["hard_fail"])
    contradictions_after = sum(1 for a in audits_after if a["contradictions"])
    short_after = sum(1 for a in audits_after if a["wc"] < 95)
    long_after = sum(1 for a in audits_after if a["wc"] > 168)
    cliche_profiles_after = sum(1 for a in audits_after if a["cliche_count"] > 0)

    # Save final polished 1,000-profile bank to data/iran_crowd.json!
    out_payload = {
        "version": "2.1-optimized",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(final_profiles),
        "profiles": final_profiles,
    }
    with open(FINAL_FILE, "w", encoding="utf-8") as f:
        json.dump(out_payload, f, ensure_ascii=False, indent=2)

    elapsed = time.perf_counter() - t0
    cost = total_in * 0.15 / 1e6 + total_out * 0.60 / 1e6

    # Score gain on the 350 targeted profiles specifically
    target_ids = {p["id"] for p in to_rewrite}
    t_before = sum(a["score"] for a in audits_before if a["id"] in target_ids) / len(target_ids)
    t_after = sum(a["score"] for a in audits_after if a["id"] in target_ids) / len(target_ids)

    prev_in = prev_report.get("tokens", {}).get("input", 0) if polish_mode else 0
    prev_out = prev_report.get("tokens", {}).get("output", 0) if polish_mode else 0
    prev_cost = prev_report.get("cost_usd", 0.0) if polish_mode else 0.0
    prev_elapsed = prev_report.get("elapsed_sec", 0.0) if polish_mode else 0.0

    report = {
        "elapsed_sec": round(prev_elapsed + elapsed, 1),
        "passes": 2 if polish_mode else 1,
        "targeted_rewrites": (prev_report.get("targeted_rewrites", 0) if polish_mode else 0) + len(to_rewrite),
        "stragglers_repolished": (prev_report.get("stragglers_repolished", 0) if polish_mode else 0) + len(stragglers),
        "accepted_rewrites": (prev_report.get("accepted_rewrites", 0) if polish_mode else 0) + accepted,
        "reverted_rewrites": (prev_report.get("reverted_rewrites", 0) if polish_mode else 0) + reverted,
        "hoods_normalized": (prev_report.get("hoods_normalized", 0) if polish_mode else 0) + hoods_cleaned,
        "tokens": {"input": prev_in + total_in, "output": prev_out + total_out},
        "cost_usd": round(prev_cost + cost, 4),
        "raw_1000": prev_report["raw_1000"] if (polish_mode and "raw_1000" in prev_report) else {
            "avg_quality_score": round(avg_score_before, 2),
            "targeted_350_avg_score": round(t_before, 2),
            "hard_fails": hard_fails_before,
            "contradictions": contradictions_before,
            "bios_under_95w": short_before,
            "bios_over_168w": long_before,
            "cliche_profiles": cliche_profiles_before,
            "max_4gram_freq": cstats_before["ngram_df"].most_common(1)[0][1],
            "top_5_4grams": cstats_before["ngram_df"].most_common(5),
        },
        "optimized_1000": {
            "avg_quality_score": round(avg_score_after, 2),
            "targeted_batch_avg_score": round(t_after, 2),
            "hard_fails": hard_fails_after,
            "contradictions": contradictions_after,
            "bios_under_95w": short_after,
            "bios_over_168w": long_after,
            "cliche_profiles": cliche_profiles_after,
            "max_4gram_freq": cstats_after["ngram_df"].most_common(1)[0][1],
            "top_5_4grams": cstats_after["ngram_df"].most_common(5),
        },
    }
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n=== OPTIMIZATION COMPLETE ({elapsed:.1f}s | Cost: ${cost:.4f}) ===", flush=True)
    print(f"  Corpus Avg Quality Score:  {avg_score_before:.2f} -> {avg_score_after:.2f} (+{avg_score_after - avg_score_before:.2f})", flush=True)
    print(f"  Targeted 350 Avg Score:    {t_before:.2f} -> {t_after:.2f} (+{t_after - t_before:.2f})", flush=True)
    print(f"  Hard Fails:                {hard_fails_before} -> {hard_fails_after} (contradictions: {contradictions_before} -> {contradictions_after})", flush=True)
    print(f"  Short (<95w) / Long (>168): {short_before}/{long_before} -> {short_after}/{long_after}", flush=True)
    print(f"  Cliché Profiles:           {cliche_profiles_before} -> {cliche_profiles_after}", flush=True)
    print(f"  Max 4-gram Repetition:     {report['raw_1000']['max_4gram_freq']} -> {report['optimized_1000']['max_4gram_freq']}", flush=True)
    print(f"  Saved final 1,000-profile bank to {FINAL_FILE} (100% Persona schema valid!)", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
