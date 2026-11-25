#!/usr/bin/env python3
"""
Crowd (مردم) — Deep Grounded Iranian Population Generator
Generates 300+ hyper-realistic, jointly-correlated, non-repetitive Iranian persona dossiers
using statistical Iranian demographic priors + DeepSeek-Flash narrative enrichment.
"""

import asyncio
import json
import os
import random
import time
from pathlib import Path
import aiohttp

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUT_FILE = DATA_DIR / "iran_crowd.json"

for line in open(ROOT / ".env", encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ[k] = v

DEEPSEEK_KEY = os.environ["DEEPSEEK_API_KEY"]

# ---------- Statistically Grounded Iranian Demographic Priors ----------

LOCATIONS = [
    # (province, city, tier, weight, neighborhoods, regional_flavor)
    ("تهران", "تهران", "تهران", 22, ["یوسف‌آباد", "ستارخان", "پونک", "تهرانپارس", "پاسداران", "الهیه", "سعادت‌آباد", "نازی‌آباد", "صادقیه", "نارمک", "ونک", "جنت‌آباد", "پیروزی", "اکباتان"], "تهرانی"),
    ("خراسان رضوی", "مشهد", "کلان‌شهر", 10, ["احمدآباد", "وکیل‌آباد", "قاسم‌آباد", "الهیه مشهد", "کوهسنگی", "سجاد", "طبرسی"], "خراسانی"),
    ("اصفهان", "اصفهان", "کلان‌شهر", 9, ["مرداویج", "جلفا", "ملک‌شهر", "سپاهان‌شهر", "چهارباغ", "دروازه شیراز", "خانه اصفهان"], "اصفهانی"),
    ("فارس", "شیراز", "کلان‌شهر", 8, ["معالی‌آباد", "فرهنگ‌شهر", "صدرا", "قدوسی", "عفیف‌آباد", "گلستان"], "شیرازی"),
    ("البرز", "کرج", "کلان‌شهر", 7, ["گوهردشت", "مهرشهر", "عظیمیه", "جهانشهر", "فردیس", "گلشهر"], "کرجی"),
    ("آذربایجان شرقی", "تبریز", "کلان‌شهر", 7, ["ولیعصر", "آبرسان", "ائل‌گلی", "نصف‌راه", "رشدیه", "زعفرانیه تبریز"], "آذری/تبریزی"),
    ("خوزستان", "اهواز", "کلان‌شهر", 5, ["کیانپارس", "زیتون کارمندی", "گلستان اهواز", "پادادشهر"], "جنوبی/خوزستانی"),
    ("گیلان", "رشت", "مرکز استان", 5, ["گلسار", "معلم", "منظریه", "رشتیان", "لاکان"], "گیلانی"),
    ("قم", "قم", "مرکز استان", 4, ["صفائیه", "سالاریه", "زنبیل‌آباد", "پردیسان"], "قمی"),
    ("کرمان", "کرمان", "مرکز استان", 3, ["هزارویک‌شب", "آزادی", "شفا", "بهمنیار"], "کرمانی"),
    ("یزد", "یزد", "مرکز استان", 3, ["صفائیه یزد", "آزادشهر", "بلوار جمهوری"], "یزدی"),
    ("مازندران", "ساری", "مرکز استان", 3, ["فرهنگ", "پیوندی", "بلوار خزر", "کوثر"], "مازندرانی"),
    ("کردستان", "سنندج", "مرکز استان", 3, ["مبارک‌آباد", "بهاران", "آبیدر"], "کرد/سنندجی"),
    ("کرمانشاه", "کرمانشاه", "مرکز استان", 3, ["نوبهار", "گلستان کرمانشاه", "الهیه کرمانشاه"], "کرمانشاهی"),
    ("هرمزگان", "بندرعباس", "مرکز استان", 2, ["گلشهر بندرعباس", "رسالت", "ساحلی"], "جنوبی/بندری"),
    ("بوشهر", "بوشهر", "مرکز استان", 2, ["بهمنی", "سنگی", "عاشوری"], "بوشهری"),
    ("همدان", "همدان", "مرکز استان", 2, ["سعیدیه", "استادان", "اعتمادیه"], "همدانی"),
    ("سیستان و بلوچستان", "زاهدان", "مرکز استان", 2, ["زیباشهر", "دانشگاه", "معلم زاهدان"], "بلوچ/سیستانی"),
    ("لرستان", "خرم‌آباد", "مرکز استان", 2, ["کیو", "گلدشت", "علوی"], "لر"),
    ("گلستان", "گرگان", "مرکز استان", 2, ["ناهارخوران", "عدالت", "شالیکوبی"], "گلستانی"),
    ("آذربایجان غربی", "ارومیه", "مرکز استان", 2, ["بند", "خیام", "گلشهر ارومیه"], "آذری/ارومیه‌ای"),
    ("سمنان", "شاهرود", "شهرستان", 2, ["مرکز شهر", "شهرک بهارستان"], "شهرستانی"),
    ("اصفهان", "کاشان", "شهرستان", 2, ["امیرکبیر", "ناجی‌آباد"], "کاشانی"),
    ("فارس", "مرودشت", "شهرستان", 2, ["مرکز شهر", "فرهنگیان"], "شهرستانی"),
    ("خراسان رضوی", "نیشابور", "شهرستان", 2, ["بلوار بعثت", "شهرک فرهنگیان"], "نیشابوری"),
]

# Jointly correlated Occupation Archetypes:
# (job_title, sector, age_range, income_range_M, allowed_genders, housing_weights, digital_pool, typical_platforms)
OCCUPATIONS = [
    ("توسعه‌دهنده نرم‌افزار", "فناوری", (23, 39), (55, 130), ["مرد", "زن"], [0.55, 0.25, 0.20], ["اینستاگرام", "تلگرام", "توییتر/ایکس", "دیجی‌کالا", "ترب", "یوتیوب"], "بلوبانک و خرید آنلاین سریع بدون حوصله برای تبلیغ زرد"),
    ("مدیر محصول / مارکتر استارتاپ", "فناوری", (25, 38), (50, 110), ["زن", "مرد"], [0.55, 0.30, 0.15], ["اینستاگرام", "تلگرام", "توییتر/ایکس", "لینکدین", "دیجی‌کالا", "اسنپ"], "دست تبلیغ‌نویس‌ها را می‌خواند و فقط به ارزش شفاف جواب می‌دهد"),
    ("دانشجوی کارشناسی/ارشد", "دانشجویی", (19, 25), (6, 16), ["زن", "مرد"], [0.15, 0.05, 0.80], ["اینستاگرام", "تلگرام", "یوتیوب", "ترب", "دیجی‌کالا", "دیوار"], "فوق‌العاده حساس به قیمت، شکارچی کد تخفیف و اشتراک رایگان"),
    ("خانه‌دار و مدیر بودجه خانواده", "خانه‌داری", (26, 52), (22, 48), ["زن"], [0.40, 0.58, 0.02], ["اینستاگرام", "ایتا", "باسلام", "دیجی‌کالا", "دیوار"], "حساس به ارسال رایگان، اسنپ‌پی قسطی و اینماد؛ نظر خریداران را دقیق می‌خواند"),
    ("پزشک / دندانپزشک", "درمان", (30, 56), (110, 240), ["زن", "مرد"], [0.15, 0.85, 0.00], ["اینستاگرام", "تلگرام", "دیجی‌کالا", "اسنپ"], "وقت بسیار کم، کیفیت‌گرا، حساس به پرستیژ و شواهد علمی؛ قیمت اولویت آخر"),
    ("پرستار / کادر درمان", "درمان", (24, 44), (20, 38), ["زن", "مرد"], [0.50, 0.35, 0.15], ["اینستاگرام", "تلگرام", "ایتا", "دیجی‌کالا", "اسنپ‌پی"], "شیفت‌های طولانی، خرید سریع از گوشی، علاقه‌مند به خرید اقساطی"),
    ("صاحب آنلاین‌شاپ اینستاگرام", "کسب‌وکار خُرد", (22, 38), (28, 75), ["زن", "مرد"], [0.45, 0.35, 0.20], ["اینستاگرام", "تلگرام", "دیوار", "ترب", "باسلام"], "روزی چند ساعت در اینستاگرام، ترفندهای تبلیغاتی را بلد است، دنبال ابزار کارآمد"),
    ("مغازه‌دار / بازاری سنتی", "تجارت سنتی", (34, 62), (45, 135), ["مرد"], [0.15, 0.85, 0.00], ["تلگرام", "اینستاگرام", "دیوار", "ایتا"], "محافظه‌کار و شکاک به استارتاپ‌های ناشناس، به سابقه و معرفی دوستان اعتماد دارد"),
    ("کارمند رسمی دولت", "دولتی", (30, 56), (17, 30), ["مرد", "زن"], [0.35, 0.65, 0.00], ["ایتا", "روبیکا", "اینستاگرام", "دیجی‌کالا", "دیوار"], "بودجه ثابت و زیر فشار قسط، طرفدار خرید اقساطی، اینماد و پشتیبانی تلفنی"),
    ("کارمند بانک / حسابدار", "مالی", (27, 49), (26, 52), ["مرد", "زن"], [0.40, 0.55, 0.05], ["تلگرام", "اینستاگرام", "دیجی‌کالا", "ترب", "ایتا"], "جزئی‌نگر و حساس به تله‌های مالی، تمدید خودکار و هزینه‌های پنهان"),
    ("کارمند بخش خصوصی", "اداری", (24, 42), (22, 45), ["زن", "مرد"], [0.55, 0.30, 0.15], ["اینستاگرام", "تلگرام", "دیجی‌کالا", "ترب", "اسنپ"], "خسته از ترافیک و کار روزانه، مقایسه قیمت در ترب و خرید قسطی دیجی‌پی/اسنپ‌پی"),
    ("راننده اسنپ / پیک / کار آزاد", "حمل‌ونقل و خدمات", (23, 50), (18, 34), ["مرد"], [0.65, 0.25, 0.10], ["اینستاگرام", "روبیکا", "دیوار", "تلگرام"], "درآمد روزمزد زیر فشار تورم، به تبلیغات پرزرق‌وبرق بی‌اعتماد، دنبال سود واقعی و قیمت کم"),
    ("معلم / دبیر مدرسه", "آموزش", (25, 52), (15, 26), ["زن", "مرد"], [0.35, 0.60, 0.05], ["ایتا", "اینستاگرام", "باسلام", "دیجی‌کالا"], "محترمانه و دقیق، به حریم خصوصی و صداقت تبلیغ اهمیت زیادی می‌دهد"),
    ("فریلنسر / طراح گرافیک / ادیتور", "خلاقیت", (21, 35), (24, 62), ["زن", "مرد"], [0.50, 0.20, 0.30], ["اینستاگرام", "تلگرام", "یوتیوب", "توییتر/ایکس", "دیجی‌کالا"], "بسیار حساس به زیبایی بصری، لحن اصیل و تجربه کاربری؛ درآمد نوسانی"),
    ("مهندس صنعت / نفت / عمران", "مهندسی", (28, 50), (45, 95), ["مرد", "زن"], [0.30, 0.68, 0.02], ["تلگرام", "اینستاگرام", "دیجی‌کالا", "ترب", "دیوار"], "منطقی و دیتامحور، دنبال مشخصات فنی واقعی و نقد کاربران، متنفر از اغراق"),
    ("تکنسین / تعمیرکار / استادکار", "فنی", (24, 48), (24, 52), ["مرد"], [0.50, 0.45, 0.05], ["اینستاگرام", "دیوار", "روبیکا", "تلگرام"], "عملی‌گرا، حوصله متن طولانی و کلمات انگلیسی ندارد، دنبال شفافیت ساده"),
    ("بازنشسته", "بازنشستگی", (57, 68), (13, 25), ["مرد", "زن"], [0.10, 0.90, 0.00], ["ایتا", "تلگرام", "روبیکا", "اینستاگرام"], "نگران کلاهبرداری اینترنتی، ترجیح پرداخت در محل یا خرید با کمک فرزندان"),
    ("آرایشگر / فعال حوزه زیبایی", "زیبایی و خدمات", (22, 41), (30, 85), ["زن", "مرد"], [0.45, 0.40, 0.15], ["اینستاگرام", "تلگرام", "دیجی‌کالا", "باسلام"], "بسیار بصری، ترندها را در اینستاگرام دنبال می‌کند، به ظاهر برند و پکیجینگ حساس است"),
    ("وکیل / مشاور حقوقی", "حقوقی", (29, 54), (65, 160), ["مرد", "زن"], [0.20, 0.80, 0.00], ["اینستاگرام", "تلگرام", "توییتر/ایکس", "دیجی‌کالا"], "بسیار تیزبین نسبت به ادعاهای بی‌پشتوانه، شرایط بازگشت وجه و شفافیت قانونی"),
    ("کارگر ماهر / نیروی کارخانه", "تولید", (22, 46), (15, 25), ["مرد"], [0.60, 0.30, 0.10], ["روبیکا", "اینستاگرام", "دیوار", "ایتا"], "بودجه محدود و کار فیزیکی سنگین، فقط برای نیاز ضروری و قیمت منصفانه هزینه می‌کند"),
]

AD_ARCHETYPES = [
    ("سریع‌ردکنِ بی‌حوصله", 4, "تبلیغات را در کمتر از ۱.۵ ثانیه رد می‌کند مگر تیتر خیلی مستقیم و غیرکلیشه‌ای باشد"),
    ("قیمت‌سنجِ ترب‌باز", 4, "هر قیمتی ببیند فوراً در ترب و دیجی‌کالا مقایسه می‌کند و به تخفیف‌های الکی می‌خندد"),
    ("زخم‌خورده کلاهبرداری اینستاگرام", 5, "قبلاً از پیج یا سایت بی‌اعتبار ضربه خورده؛ بدون اینماد، نظر واقعی و امکان مرجوعی خرید نمی‌کند"),
    ("کیفیت‌گرای کم‌وقت", 3, "حاضر است هزینه خوب بدهد اما از شلوغ‌کاری، فشار زمانی ساختگی و لحن آماتور متنفر است"),
    ("شکارچی تخفیف و قسط", 3, "ارسال رایگان، تست رایگان و خرید قسطی اسنپ‌پی/دیجی‌پی محرک اصلی تصمیمش است"),
    ("حساس به حریم خصوصی", 4, "نسبت به دسترسی دوربین، پیامک بانکی، شماره تماس و اشتراک تمدید خودکار بسیار محتاط است"),
    ("سنتیِ نیازمند اعتماد", 5, "به برندهای ناشناس آنلاین دیر اعتماد می‌کند؛ پشتیبانی واقعی و شفافیت کامل می‌خواهد"),
    ("تکنولوژی‌دوستِ پیشتاز", 2, "از محصولات جدید و مدرن استقبال می‌کند به شرطی که واقعی، خوش‌طراحی و بدون شعار زرد باشند"),
]

FIRST_NAMES_M = [
    "امیرحسین", "محمدرضا", "آرش", "سعید", "مهدی", "رضا", "علیرضا", "حسین", "کیانوش", "پارسا",
    "بهرام", "مرتضی", "سهیل", "امید", "حمیدرضا", "فرهاد", "پویا", "میلاد", "سینا", "شایان",
    "مسعود", "جواد", "ناصر", "کاوه", "ایمان", "نیما", "عرفان", "داوود", "عباس", "بابک",
    "سامان", "پدرام", "حامد", "آرمین", "یاشار", "آیدین", "سوران", "هیوا", "شهرام", "مجید",
    "وحید", "محسن", "مصطفی", "کامیار", "مازیار", "بهزاد", "سیامک", "احسان", "فرزین", "رامتین",
]
FIRST_NAMES_F = [
    "مریم", "زهرا", "سارا", "فاطمه", "نگار", "سمیرا", "یلدا", "مهسا", "نرگس", "شیوا",
    "تارا", "نازنین", "آیلار", "پروین", "شیدا", "هستی", "پریسا", "الهام", "مینا", "سحر",
    "آزاده", "غزل", "کیمیا", "درسا", "هدیه", "ملیکا", "لیلا", "رویا", "فرزانه", "شبنم",
    "آرزو", "سمانه", "عاطفه", "محدثه", "نسترن", "سپیده", "آوا", "دلارام", "سولماز", "روژین",
    "مهناز", "اکرم", "طاهره", "بهاره", "نیلوفر", "مرجان", "راحله", "ثمین", "سوگل", "طناز",
]
LAST_NAMES = [
    "کریمی", "حسینی", "رضایی", "محمدی", "شریفی", "مرادی", "اکبری", "موسوی", "قاسمی", "زارع",
    "جعفری", "صادقی", "حیدری", "نوری", "احمدی", "طاهری", "بهرامی", "فرهادی", "نادری", "کاظمی",
    "سلیمانی", "امینی", "رحیمی", "باقری", "یوسفی", "تقی‌زاده", "غلامی", "عسگری", "اسدی", "هاشمی",
    "فتحی", "عزیزی", "یزدانی", "ترابی", "پناهی", "جمشیدی", "عباسی", "میرزایی", "ملکی", "رستمی",
    "خسروی", "شجاعی", "بختیاری", "انصاری", "شعبانی", "درویشی", "قربانی", "مختاری", "صفری", "مهدوی",
    "آذری", "تبریزی", "شیرازی", "اصفهانی", "گیلانی", "خراسانی", "راد", "پارسا", "فرجی", "نیکبخت",
]


def income_tier_label(m: int) -> str:
    if m <= 16:
        return "کم‌درآمد"
    if m <= 28:
        return "متوسط رو به پایین"
    if m <= 50:
        return "متوسط"
    if m <= 95:
        return "متوسط رو به بالا"
    return "مرفه"


def build_skeletons(n: int = 300, seed: int = 1405):
    rng = random.Random(seed)
    loc_weights = [l[3] for l in LOCATIONS]
    used_names = set()
    skeletons = []

    for i in range(n):
        province, city, city_tier, _, hoods, flavor = rng.choices(LOCATIONS, weights=loc_weights, k=1)[0]
        hood = rng.choice(hoods)
        occ = rng.choice(OCCUPATIONS)
        job, sector, (amin, amax), (imin, imax), genders, hweights, plat_pool, pay_hint = occ

        gender = rng.choice(genders)
        age = rng.randint(amin, amax)

        # Slight city cost-of-living income adjustment (Tehran +20%, small town -15%)
        mult = 1.18 if city_tier == "تهران" else (1.0 if city_tier == "کلان‌شهر" else (0.9 if city_tier == "مرکز استان" else 0.82))
        income_m = max(6, int(round(rng.randint(imin, imax) * mult)))

        # Marital status correlated with age
        if age <= 24:
            marital = rng.choices(["مجرد", "متاهل بدون فرزند"], weights=[0.85, 0.15])[0]
        elif age <= 32:
            marital = rng.choices(["مجرد", "متاهل بدون فرزند", "متاهل با فرزند"], weights=[0.42, 0.28, 0.30])[0]
        elif age <= 45:
            marital = rng.choices(["مجرد", "متاهل بدون فرزند", "متاهل با فرزند"], weights=[0.16, 0.16, 0.68])[0]
        else:
            marital = rng.choices(["مجرد", "متاهل بدون فرزند", "متاهل با فرزند"], weights=[0.06, 0.10, 0.84])[0]

        housing = rng.choices(["مستاجر", "مالک", "با خانواده"], weights=hweights)[0]
        if age >= 38 and housing == "با خانواده":
            housing = "مستاجر"

        # Unique authentic name
        for _ in range(50):
            fn = rng.choice(FIRST_NAMES_F if gender == "زن" else FIRST_NAMES_M)
            ln = rng.choice(LAST_NAMES)
            full = f"{fn} {ln}"
            if full not in used_names:
                used_names.add(full)
                break

        # Pick correlated archetype
        arch_name, base_skep, arch_desc = rng.choice(AD_ARCHETYPES)
        if sector == "بازنشستگی" and rng.random() < 0.6:
            arch_name, base_skep, arch_desc = AD_ARCHETYPES[6]
        elif sector == "درمان" and income_m > 100 and rng.random() < 0.6:
            arch_name, base_skep, arch_desc = AD_ARCHETYPES[3]
        elif sector == "دانشجویی" and rng.random() < 0.55:
            arch_name, base_skep, arch_desc = rng.choice([AD_ARCHETYPES[0], AD_ARCHETYPES[1], AD_ARCHETYPES[4]])
        elif sector == "فناوری" and rng.random() < 0.55:
            arch_name, base_skep, arch_desc = rng.choice([AD_ARCHETYPES[0], AD_ARCHETYPES[5], AD_ARCHETYPES[7]])

        skep = min(5, max(1, base_skep + rng.choice([-1, 0, 0, 1])))
        platforms = rng.sample(plat_pool, k=min(len(plat_pool), rng.randint(3, 4)))

        skeletons.append({
            "id": f"ir_{i+1:03d}",
            "name": full,
            "gender": gender,
            "age": age,
            "province": province,
            "city": city,
            "neighborhood": hood,
            "city_tier": city_tier,
            "regional_flavor": flavor,
            "job": job,
            "sector": sector,
            "monthly_income_m": income_m,
            "income_tier": income_tier_label(income_m),
            "marital_status": marital,
            "housing": housing,
            "platforms": platforms,
            "payment_habit": pay_hint,
            "ad_archetype": arch_name,
            "ad_archetype_desc": arch_desc,
            "ad_skepticism": skep,
            "avatar_hue": (i * 37 + 195) % 360,
        })
    return skeletons


async def enrich_batch(session: aiohttp.ClientSession, sem: asyncio.Semaphore, batch: list, batch_idx: int):
    brief_list = [
        {
            "id": s["id"],
            "name": s["name"],
            "info": f"{s['gender']} {s['age']} ساله، ساکن {s['neighborhood']} {s['city']} ({s['province']})، شغل: {s['job']}، درآمد ماهانه: {s['monthly_income_m']} میلیون تومان ({s['income_tier']})، {s['marital_status']}، {s['housing']}، اپ‌ها: {'، '.join(s['platforms'])}، تیپ تبلیغی: {s['ad_archetype']} (بدبینی {s['ad_skepticism']} از ۵) — {s['ad_archetype_desc']}. عادت مالی: {s['payment_habit']}",
        }
        for s in batch
    ]

    prompt = f"""تو یک جامعه‌شناس و پژوهشگر بازار ایران در سال ۱۴۰۵ هستی.
برای هر کدام از {len(batch)} شخص زیر، یک پروفایل **بسیار عمیق، واقعی، ملموس و کاملاً متمایز** به فارسی بنویس که شبیه یک انسان واقعی ایرانی باشد (اصلاً کلیشه‌ای یا کتابی نباشد!).

برای هر شخص دقیقاً این ۳ فیلد را تولید کن:
1) `life_story` (دقیقاً بین ۱۱۰ تا ۱۵۰ کلمه فارسی):
   - جزئیات واقعی روزمره و فشارهای مالی/زمانی (مثلاً قسط، اجاره، رفت‌وآمد، ترافیک، دغدغه خانواده یا رشد شغلی)
   - یک تجربه مشخص قبلی از خرید آنلاین یا دیدن تبلیغ (مثلاً یک بار سرش کلاه رفته یا خرید موفقی داشته که رفتارش را شکل داده)
   - دقیقاً چه چیزی هنگام اسکرول اینستاگرام/تلگرام/ایتا باعث توقفش می‌شود و چه عباراتی فوراً باعث شک و رد کردن تبلیغ می‌شود
   - حساسیت‌های واقعی (قیمت تومانی، اینماد، مرجوعی، حریم خصوصی، لحن تبلیغ، فیلترشکن، ارسال شهرستان و...)
   - تنوع بالا: هر نفر سبک زندگی، دغدغه و مثال متفاوتی از نفر قبلی داشته باشد!
2) `voice_sample` (یک جمله کوتاه محاوره‌ای طبیعی فارسی که لحن حرف زدن واقعی این شخص هنگام دیدن تبلیغ را نشان دهد).
3) `triggers` (آرایه ۲ تا ۳ تگ کوتاه ۳ کلمه‌ای از محرک‌های اصلی خریدش، مثل "تست رایگان بی‌ریسک"، "ارسال رایگان شهرستان").
4) `red_flags` (آرایه ۲ تا ۳ تگ کوتاه ۳ کلمه‌ای از خطوط قرمزش، مثل "قیمت مخفی"، "کارت‌به‌کارت بدون اینماد").

ورودی اشخاص:
{json.dumps(brief_list, ensure_ascii=False)}

خروجی را دقیقاً به صورت JSON با کلید `profiles` (آرایه‌ای با همان `id` ها) برگردان:
{{"profiles": [{{"id": "...", "life_story": "...", "voice_sample": "...", "triggers": ["..."], "red_flags": ["..."]}}]}}"""

    async with sem:
        for attempt in range(3):
            t0 = time.perf_counter()
            try:
                async with session.post(
                    "https://api.deepseek.com/chat/completions",
                    headers={"Authorization": f"Bearer {DEEPSEEK_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": "deepseek-flash",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 5500,
                        "temperature": 0.9,
                        "thinking": {"type": "disabled"},
                        "response_format": {"type": "json_object"},
                    },
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as resp:
                    text = await resp.text()
                    if resp.status != 200:
                        raise RuntimeError(f"HTTP {resp.status}: {text[:300]}")
                    data = json.loads(text)
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    items = {p["id"]: p for p in parsed["profiles"]}
                    if len(items) < len(batch):
                        raise ValueError(f"Only got {len(items)}/{len(batch)} profiles")
                    ms = round((time.perf_counter() - t0) * 1000)
                    usage = data.get("usage", {})
                    print(f"  Batch {batch_idx+1:02d} OK ({len(items)} profiles, {ms}ms, {usage.get('completion_tokens', 0)} out_tok)", flush=True)
                    return items, usage
            except Exception as e:
                print(f"  Batch {batch_idx+1:02d} attempt {attempt+1} error: {e}", flush=True)
                await asyncio.sleep(2 * (attempt + 1))
        raise RuntimeError(f"Batch {batch_idx+1} failed after 3 retries")


async def main():
    n_total = 300
    batch_size = 10
    print(f"Generating {n_total} ultra-deep Iranian profiles in {n_total // batch_size} batches via DeepSeek-Flash...")
    t0 = time.perf_counter()
    skeletons = build_skeletons(n_total)

    sem = asyncio.Semaphore(10)
    total_in = 0
    total_out = 0
    enriched_map = {}

    async with aiohttp.ClientSession() as session:
        tasks = [
            enrich_batch(session, sem, skeletons[i : i + batch_size], i // batch_size)
            for i in range(0, n_total, batch_size)
        ]
        results = await asyncio.gather(*tasks)
        for items, usage in results:
            enriched_map.update(items)
            total_in += usage.get("prompt_tokens", 0)
            total_out += usage.get("completion_tokens", 0)

    final_profiles = []
    for s in skeletons:
        e = enriched_map[s["id"]]
        final_profiles.append({
            **s,
            "life_story": e["life_story"].strip(),
            "voice_sample": e["voice_sample"].strip(),
            "triggers": e.get("triggers", [])[:3],
            "red_flags": e.get("red_flags", [])[:3],
        })

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(
            {
                "version": "1.0",
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "count": len(final_profiles),
                "profiles": final_profiles,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    elapsed = time.perf_counter() - t0
    cost = total_in * 0.15 / 1e6 + total_out * 0.60 / 1e6
    avg_words = sum(len(p["life_story"].split()) for p in final_profiles) / len(final_profiles)
    print(f"\nDONE! {len(final_profiles)} ultra-deep Iranian profiles saved to {OUT_FILE}")
    print(f"  Time: {elapsed:.1f}s | Avg bio length: {avg_words:.0f} Persian words | Tokens: {total_in:,} in / {total_out:,} out | Est cost: ${cost:.4f}")
    print("\nSample profiles:")
    for idx in [0, 42, 150, 275]:
        p = final_profiles[idx]
        print(f"  [{p['id']}] {p['name']} ({p['age']}yo {p['gender']}, {p['neighborhood']} {p['city']}, {p['job']}, {p['monthly_income_m']}M, {p['ad_archetype']}):")
        print(f"    Bio: {p['life_story'][:210]}...")
        print(f"    Voice: «{p['voice_sample']}»")


if __name__ == "__main__":
    asyncio.run(main())
