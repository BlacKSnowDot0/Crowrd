#!/usr/bin/env python3
"""
Crowd (مردم) — Empirical Lab Suite for Perplexity Decider v1.3 + DeepSeek Flash
Tests Persian persona fidelity, batching architecture, Flash vs 27B, symmetry/bias,
Persian `locate` heatmaps, multimodal ad creatives, 100-persona scale, and System 1 -> System 2 hybrid.
"""

import base64
import io
import json
import math
import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFont

# ---------- Setup ----------
ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = ROOT / "experiments" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def load_env(path: Path = ROOT / ".env"):
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k] = v


load_env()
PPLX_KEY = os.environ["PERPLEXITY_API_KEY"]
DEEPSEEK_KEY = os.environ["DEEPSEEK_API_KEY"]

PPLX_URL = "https://api.perplexity.ai/v1/decisions"
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

SESSION = requests.Session()


def call_decider(model: str, state, questions: dict, extra: dict | None = None, timeout: int = 60):
    payload = {"model": model, "state": state, "questions": questions}
    if extra:
        payload.update(extra)
    t0 = time.perf_counter()
    resp = SESSION.post(
        PPLX_URL,
        headers={
            "Authorization": f"Bearer {PPLX_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    ms = round((time.perf_counter() - t0) * 1000)
    if resp.status_code != 200:
        raise RuntimeError(f"Decider HTTP {resp.status_code} ({ms}ms): {resp.text[:500]}")
    data = resp.json()
    return {"ms": ms, "data": data}


def call_deepseek(messages: list, max_tokens: int = 300, thinking: bool = False, temperature: float = 0.7):
    payload = {
        "model": "deepseek-flash",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if not thinking:
        payload["thinking"] = {"type": "disabled"}
    t0 = time.perf_counter()
    resp = SESSION.post(
        DEEPSEEK_URL,
        headers={
            "Authorization": f"Bearer {DEEPSEEK_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=60,
    )
    ms = round((time.perf_counter() - t0) * 1000)
    if resp.status_code != 200:
        raise RuntimeError(f"DeepSeek HTTP {resp.status_code} ({ms}ms): {resp.text[:500]}")
    return {"ms": ms, "data": resp.json()}


def spearman_corr(xs, ys):
    rx = np.argsort(np.argsort(xs)).astype(float)
    ry = np.argsort(np.argsort(ys)).astype(float)
    if np.std(rx) == 0 or np.std(ry) == 0:
        return 0.0
    return float(np.corrcoef(rx, ry)[0, 1])


# ---------- 12 Grounded Iranian Personas ----------
PERSONAS_12 = [
    {
        "id": "p01_tehran_dev",
        "label": "امیر ۲۷ساله، برنامه‌نویس شمال تهران",
        "fa": "امیر، ۲۷ ساله، مجرد، برنامه‌نویس ارشد در شمال تهران با درآمد ۸۵ میلیون تومان در ماه. اهل تکنولوژی و ابزارهای بهره‌وری، خرید آنلاین همیشگی از دیجی‌کالا و اسنپ، به حریم خصوصی و کیفیت UI حساس است و برای نرم‌افزار خوب پول می‌دهد.",
        "en": "Amir, 27yo single senior software engineer in North Tehran earning 85M Toman/mo. Tech-savvy, heavy online buyer (Digikala/Snapp), cares about privacy and clean UI, gladly pays for quality productivity software.",
    },
    {
        "id": "p02_shiraz_student",
        "label": "سارا ۲۱ساله، دانشجو شیراز",
        "fa": "سارا، ۲۱ ساله، دانشجوی کارشناسی در شیراز، وابسته به کمک‌هزینه خانواده (ماهانه ۷ میلیون تومان). خیلی در اینستاگرام و تلگرام فعال است، دنبال تخفیف و نسخه رایگان است و هزینه اشتراک ماهانه برایش سنگین است.",
        "en": "Sara, 21yo undergrad student in Shiraz on a tight 7M Toman/mo family allowance. Very active on Instagram/Telegram, hunts for discounts and free apps, finds monthly subscriptions unaffordable.",
    },
    {
        "id": "p03_isfahan_bazaar",
        "label": "حاج محمود ۵۸ساله، بازاری اصفهان",
        "fa": "محمود، ۵۸ ساله، متاهل، مغازه‌دار و عمده‌فروش پارچه در بازار اصفهان با درآمد بالا ولی روش سنتی. به اپلیکیشن‌های جدید و دادن دسترسی پیامک بانکی به شدت بی‌اعتماد است و حساب‌هایش را در دفترچه و با حسابدار نگه می‌دارد.",
        "en": "Mahmoud, 58yo married traditional fabric merchant in Isfahan bazaar with high income. Deeply distrusts new apps and giving bank SMS access; tracks accounts in a ledger with his accountant.",
    },
    {
        "id": "p04_mashhad_mom",
        "label": "زهرا ۳۴ساله، خانه‌دار مشهد",
        "fa": "زهرا، ۳۴ ساله، متاهل با دو فرزند در مشهد، مدیریت هزینه‌های خانواده با درآمد ۲۸ میلیون تومان در ماه. به شدت به قیمت، ارسال رایگان، خرید اقساطی اسنپ‌پی/دیجی‌پی و نماد اعتماد اهمیت می‌دهد و خرید آنلاینش محتاطانه است.",
        "en": "Zahra, 34yo married mother of two in Mashhad managing a 28M Toman/mo household budget. Very price-sensitive, loves free shipping, SnappPay/Digipay installments, and E-Namad trust badges; cautious online shopper.",
    },
    {
        "id": "p05_tehran_doctor",
        "label": "دکتر نگار ۴۴ساله، پزشک متخصص تهران",
        "fa": "نگار، ۴۴ ساله، پزشک متخصص در تهران با درآمد بالای ۱۵۰ میلیون تومان و وقت بسیار کم. حاضر است هزینه بالایی بدهد به شرط اینکه محصول شیک، باکیفیت، بدون دردسر و باعث صرفه‌جویی در وقتش شود. از تخفیف‌های تبلیغاتی شلوغ بدش می‌آید.",
        "en": "Negar, 44yo specialist physician in Tehran earning 150M+ Toman/mo with very little free time. Willingly pays premium for sleek, reliable, time-saving products; dislikes loud spammy discount ads.",
    },
    {
        "id": "p06_karaj_snapp",
        "label": "رضا ۲۹ساله، راننده اسنپ کرج",
        "fa": "رضا، ۲۹ ساله، متاهل در کرج، راننده اسنپ با درآمد روزمزد حدود ۲۲ میلیون تومان در ماه. همه هزینه‌هایش را روی گوشی چک می‌کند ولی زیر فشار تورم است، ترجیح می‌دهد از ابزار رایگان استفاده کند یا پرداخت خیلی کم و اقساطی داشته باشد.",
        "en": "Reza, 29yo married Snapp driver in Karaj earning ~22M Toman/mo daily income. Checks finances on phone under inflation pressure; strongly prefers free tools or tiny/installment payments.",
    },
    {
        "id": "p07_tabriz_shop",
        "label": "آیلار ۳۳ساله، آنلاین‌شاپ اینستاگرام تبریز",
        "fa": "آیلار، ۳۳ ساله، صاحب آنلاین‌شاپ پوشاک در اینستاگرام در تبریز با درآمد ۴۵ میلیون تومان در ماه. روزانه کلی واریزی کارت‌به‌کارت و پیامک بانکی دارد و مدیریت حساب‌های شخصی و کاری برایش معضل است. عاشق ابزارهایی است که کارش را راحت‌تر کند.",
        "en": "Aylar, 33yo Instagram fashion shop owner in Tabriz earning 45M Toman/mo. Deals with dozens of daily card-to-card transfers and bank SMSs; struggles mixing personal/business finances and loves time-saving tools.",
    },
    {
        "id": "p08_qom_gov",
        "label": "حسین ۴۶ساله، کارمند دولت قم",
        "fa": "حسین، ۴۶ ساله، کارمند رسمی دولت در قم با حقوق ۱۸ میلیون تومان و دو فرزند. محافظه‌کار در خرید اینترنتی، فقط از سایت‌های معتبر با اینماد یا پرداخت در محل خرید می‌کند و بیشتر در ایتا و پیام‌رسان‌های داخلی فعال است.",
        "en": "Hossein, 46yo government employee in Qom earning 18M Toman/mo with two kids. Conservative online buyer, only trusts official E-Namad sites or cash-on-delivery, mainly active on Eitaa and domestic messengers.",
    },
    {
        "id": "p09_tehran_genz",
        "label": "آرتین ۱۹ساله، گیمر و تولیدکننده محتوا تهران",
        "fa": "آرتین، ۱۹ ساله، دانش‌آموز/تولیدکننده محتوای یوتیوب و اینستاگرام در تهران. با لحن شوخ و میم‌های روز ارتباط می‌گیرد، از تبلیغات رسمی و خشک فراری است، قهوه تخصصی و سبک زندگی مدرن را دوست دارد ولی درآمد ثابتی ندارد.",
        "en": "Artin, 19yo content creator/gamer in Tehran. Resonates with humorous Gen-Z memes, hates stiff corporate ads, loves specialty coffee and modern aesthetics, irregular income.",
    },
    {
        "id": "p10_rasht_retiree",
        "label": "پروین ۶۳ساله، معلم بازنشسته رشت",
        "fa": "پروین، ۶۳ ساله، معلم بازنشسته در رشت با حقوق ۱۵ میلیون تومان. با اینترنت و تلگرام آشنایی محدود دارد، از پرداخت آنلاین می‌ترسد و حتماً می‌خواهد با تلفن با پشتیبانی انسانی صحبت کند و در محل پول بدهد.",
        "en": "Parvin, 63yo retired teacher in Rasht earning 15M Toman/mo. Limited tech comfort, nervous about online prepayment, insists on phone support with a real human and cash-on-delivery.",
    },
    {
        "id": "p11_ahvaz_eng",
        "label": "میلاد ۳۶ساله، مهندس نفت اهواز",
        "fa": "میلاد، ۳۶ ساله، مهندس شرکت نفت در اهواز با درآمد ۶۵ میلیون تومان. منطقی و تحلیلی، قبل از خرید نظرات کاربران را می‌خواند، برای محصولات با ارزش واقعی و شفافیت کامل پول می‌دهد ولی به ادعاهای اغراق‌آمیز شک می‌کند.",
        "en": "Milad, 36yo oil engineer in Ahvaz earning 65M Toman/mo. Analytical and pragmatic, reads reviews carefully before buying, pays for transparent real value, skeptical of exaggerated claims.",
    },
    {
        "id": "p12_kerman_freelancer",
        "label": "نازنین ۲۶ساله، طراح گرافیک فریلنسر کرمان",
        "fa": "نازنین، ۲۶ ساله، طراح گرافیک فریلنسر در کرمان با درآمد متغیر حدود ۳۰ میلیون تومان. به زیبایی بصری، برندینگ اصیل و تجربه کاربری خیلی اهمیت می‌دهد. درآمدش نوسانی است پس به خرید اقساطی یا پلن‌های منعطف علاقه دارد.",
        "en": "Nazanin, 26yo freelance graphic designer in Kerman earning ~30M Toman/mo irregularly. Cares deeply about visual aesthetics, authentic branding, and UX; likes flexible or installment plans due to uneven income.",
    },
]

# ---------- Stimuli ----------
STIMULUS_FINTECH = (
    "محصول: اپلیکیشن ایرانی مدیریت مالی شخصی «کیف‌یار».\n"
    "امکانات: خواندن خودکار پیامک‌های بانکی و دسته‌بندی هزینه‌ها، هشدار بودجه ماهانه، تفکیک حساب شخصی و کاری، و گزارش سود و زیان.\n"
    "قیمت: اشتراک ماهانه ۳۹۰ هزار تومان (یا اشتراک سالانه ۲ میلیون و ۹۰۰ هزار تومان). ۷ روز تست رایگان. دارای اینماد و سرور داخل ایران."
)

STIMULUS_COFFEE_ADS = (
    "سه متن تبلیغ اینستاگرامی برای یک برند جدید قهوه تخصصی ایرانی (بسته ۲۵۰ گرمی ۴۸۰ هزار تومان):\n"
    "- گزینه A (رسمی و لوکس): «رُست تخصصی دانه‌های ۱۰۰٪ عربیکا اتیوپی؛ انتخاب مدیران و حرفه‌ای‌هایی که به کیفیت و زمان خود احترام می‌گذارند. ارسال سریع در بسته‌بندی وکیوم.»\n"
    "- گزینه B (شوخ و نسل Z): «صبح بدون قهوه یعنی سیستم‌عاملت بالا نیومده! ☕️💀 یه شات از قهوه‌هامون بزن تا مغزت رفرش شه. دایرکت بده رفیق، رُست تازه‌ش داغه!»\n"
    "- گزینه C (تخفیفی و ارزش خرید): «۳۰٪ تخفیف اولین سفارش + ارسال رایگان به سراسر ایران + امکان پرداخت ۴ قسطه با اسنپ‌پی! قهوه تازه بدون واسطه مستقیم از کارگاه با ضمانت بازگشت وجه.»"
)

STIMULUS_CHECKOUT_POLICY = (
    "تغییر سیاست یک فروشگاه آنلاین ایرانی لوازم خانگی و دیجیتال:\n"
    "از ماه آینده، «پرداخت در محل» به طور کامل حذف می‌شود و تمام سفارش‌ها باید از قبل آنلاین پرداخت شوند. "
    "همچنین پشتیبانی تلفنی حذف شده و پاسخگویی فقط از طریق ربات تلگرام و تیکت انجام می‌شود. "
    "در عوض، قیمت محصولات ۵٪ ارزان‌تر شده و ارسال اکسپرس ۲۴ ساعته فعال می‌شود."
)

STIMULUS_LANDING_LOCATE = (
    "فروش ویژه کرم ضدآفتاب و سرم ویتامین C برند «نوراپلاس»! "
    "فقط تا پایان امشب ۹۰٪ تخفیف استثنایی روی تمام محصولات داریم و بعد از امشب قیمت‌ها ۳ برابر می‌شود. "
    "محصول ما دارای تاییدیه سازمان غذا و دارو و نماد اعتماد الکترونیک (اینماد) است و بیش از ۱۲ هزار نظر مثبت در دیجی‌کالا دارد. "
    "ارسال رایگان با تیپاکس به سراسر ایران و امکان پرداخت ۴ قسطه بدون سود با اسنپ‌پی فراهم است. "
    "توجه: به دلیل فروش فوق‌العاده، ثبت سفارش فقط به صورت کارت‌به‌کارت انجام می‌شود و کالا به هیچ عنوان امکان مرجوعی یا تعویض ندارد."
)


def print_header(title: str):
    print("\n" + "=" * 78)
    print(f"  {title}")
    print("=" * 78)


def exp1_persona_sensitivity():
    print_header("EXP 1: PERSIAN PERSONA DIFFERENTIATION (12 Personas x 3 Real Scenarios)")
    results = {}

    # Scenario A: Fintech buy intent (noul) + willingness score (score) + payment choice (choice)
    # Run Pattern A: all 12 personas in ONE call per question type
    q_noul = {
        p["id"]: {
            "type": "noul",
            "instructions": (
                f"شخصیت تو: {p['fa']}\n"
                "با توجه به شخصیت، درآمد، نیاز و میزان اعتماد خودت به عنوان این فرد ایرانی، "
                "آیا حاضر هستی اشتراک ماهانه ۳۹۰ هزار تومانی اپلیکیشن کیف‌یار را بخری؟"
            ),
            "criteria": {
                "true": "این شخص واقعاً این اشتراک را می‌خرد و حاضر به پرداخت است.",
                "false": "این شخص نمی‌خرد (به دلیل قیمت، بی‌اعتمادی به دسترسی پیامک بانکی، یا عدم نیاز).",
            },
        }
        for p in PERSONAS_12
    }
    r_fintech_noul = call_decider("pplx-decider-v1.3", STIMULUS_FINTECH, q_noul)

    q_pay_choice = {
        p["id"]: {
            "type": "choice",
            "instructions": (
                f"شخصیت تو: {p['fa']}\n"
                "کدام مدل را برای اپلیکیشن کیف‌یار انتخاب می‌کنی؟"
            ),
            "criteria": {
                "monthly_390k": "پرداخت اشتراک ماهانه ۳۹۰ هزار تومان",
                "yearly_or_bnpl": "پرداخت اقساطی یا تخفیف‌دار سالانه",
                "free_with_ads": "فقط نسخه رایگان با تبلیغات",
                "reject_privacy": "اصلاً نصب نمی‌کنم چون به دسترسی پیامک بانکی اعتماد ندارم",
            },
        }
        for p in PERSONAS_12
    }
    r_fintech_choice = call_decider("pplx-decider-v1.3", STIMULUS_FINTECH, q_pay_choice)

    # Scenario B: Coffee Ad A/B/C choice
    q_coffee = {
        p["id"]: {
            "type": "choice",
            "instructions": (
                f"شخصیت تو: {p['fa']}\n"
                "کدام یک از سه تبلیغ قهوه بیشتر تو را جذب می‌کند و احتمال کلیک و خریدت را بالا می‌برد؟"
            ),
            "criteria": {
                "ad_A_luxury": "گزینه A (رسمی و لوکس)",
                "ad_B_genz": "گزینه B (شوخ و نسل Z)",
                "ad_C_discount": "گزینه C (تخفیفی، ارسال رایگان و اقساطی)",
            },
        }
        for p in PERSONAS_12
    }
    r_coffee = call_decider("pplx-decider-v1.3", STIMULUS_COFFEE_ADS, q_coffee)

    # Scenario C: Removing COD + phone support -> Score (0..4)
    q_checkout = {
        p["id"]: {
            "type": "score",
            "instructions": (
                f"شخصیت تو: {p['fa']}\n"
                "با توجه به این تغییر سیاست فروشگاه، چقدر احتمال دارد همچنان از این فروشگاه خرید کنی؟"
            ),
            "criteria": [
                "اصلاً دیگر خرید نمی‌کنم",
                "احتمالاً خرید نمی‌کنم",
                "مردد هستم",
                "احتمالاً همچنان خرید می‌کنم",
                "حتماً با استقبال خرید می‌کنم",
            ],
        }
        for p in PERSONAS_12
    }
    r_checkout = call_decider("pplx-decider-v1.3", STIMULUS_CHECKOUT_POLICY, q_checkout)

    print(f"API Latency & Usage (all 12 personas in ONE call each):")
    for name, r in [
        ("Fintech Noul", r_fintech_noul),
        ("Fintech PayChoice", r_fintech_choice),
        ("Coffee Ad A/B/C", r_coffee),
        ("Checkout Score", r_checkout),
    ]:
        u = r["data"].get("usage", {})
        cost = u.get("input_tokens", 0) * 0.02 / 1_000_000
        print(f"  {name:20s}: {r['ms']:4d}ms | {u.get('input_tokens', 0):5d} in_tok | ${cost:.6f}")

    print("\nPersona Breakdown:")
    print(f"{'Persona':34s} | {'Buy390k':7s} | {'PayPref':15s} | {'AdWin (p)':18s} | {'KeepShop(0-4)':13s}")
    print("-" * 98)

    buy_probs = []
    checkout_scores = []
    ad_winners = {"ad_A_luxury": 0, "ad_B_genz": 0, "ad_C_discount": 0}

    for p in PERSONAS_12:
        pid = p["id"]
        bp = r_fintech_noul["data"]["answers"][pid]["noul"]
        pc = r_fintech_choice["data"]["answers"][pid]["choice"]
        ad_ans = r_coffee["data"]["answers"][pid]
        ad_w = ad_ans["choice"]
        ad_p = ad_ans["probabilities"][ad_w]
        ad_winners[ad_w] += 1
        cs = r_checkout["data"]["answers"][pid]["score"]
        buy_probs.append(bp)
        checkout_scores.append(cs)
        print(f"{p['label']:34s} | {bp:6.1%} | {pc:15s} | {ad_w:13s} {ad_p:4.0%} | {cs:5.2f} / 4.00")

    print("\nSpread Diagnostics:")
    print(f"  Fintech Buy Prob:  min={min(buy_probs):.1%}, max={max(buy_probs):.1%}, mean={statistics.mean(buy_probs):.1%}, std={statistics.stdev(buy_probs):.1%}")
    print(f"  Checkout Score:    min={min(checkout_scores):.2f}, max={max(checkout_scores):.2f}, mean={statistics.mean(checkout_scores):.2f}, std={statistics.stdev(checkout_scores):.2f}")
    print(f"  Coffee Ad Winners: {ad_winners}")

    results["fintech_noul"] = r_fintech_noul
    results["fintech_choice"] = r_fintech_choice
    results["coffee_ads"] = r_coffee
    results["checkout_score"] = r_checkout
    return results, {p["id"]: r_fintech_noul["data"]["answers"][p["id"]]["noul"] for p in PERSONAS_12}


def exp2_architecture_showdown(pattern_a_probs: dict):
    print_header("EXP 2: ARCHITECTURE SHOWDOWN (Batched vs Isolated vs Flash vs English)")

    # Pattern B: Isolated calls (Persona + Stimulus in state, 1 question per request) in parallel
    t0 = time.perf_counter()
    pattern_b_probs = {}
    b_tokens = 0
    b_latencies = []

    def run_isolated(p):
        st = {
            "شخصیت_کاربر": p["fa"],
            "محصول": STIMULUS_FINTECH,
        }
        q = {
            "buy": {
                "type": "noul",
                "instructions": "آیا این کاربر با توجه به شخصیت، درآمد، نیاز و میزان اعتمادش حاضر است اشتراک ماهانه ۳۹۰ هزار تومانی اپلیکیشن کیف‌یار را بخرد؟",
                "criteria": {
                    "true": "این شخص واقعاً این اشتراک را می‌خرد و حاضر به پرداخت است.",
                    "false": "این شخص نمی‌خرد (به دلیل قیمت، بی‌اعتمادی به دسترسی پیامک بانکی، یا عدم نیاز).",
                },
            }
        }
        res = call_decider("pplx-decider-v1.3", st, q)
        return p["id"], res

    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(run_isolated, p) for p in PERSONAS_12]
        for fut in as_completed(futs):
            pid, res = fut.result()
            pattern_b_probs[pid] = res["data"]["answers"]["buy"]["noul"]
            b_tokens += res["data"].get("usage", {}).get("input_tokens", 0)
            b_latencies.append(res["ms"])
    b_wall_ms = round((time.perf_counter() - t0) * 1000)

    # Pattern C: pplx-decider-flash-v1.3 (4B) batched
    q_noul_fa = {
        p["id"]: {
            "type": "noul",
            "instructions": (
                f"شخصیت تو: {p['fa']}\n"
                "با توجه به شخصیت، درآمد، نیاز و میزان اعتماد خودت به عنوان این فرد ایرانی، "
                "آیا حاضر هستی اشتراک ماهانه ۳۹۰ هزار تومانی اپلیکیشن کیف‌یار را بخری؟"
            ),
            "criteria": {
                "true": "این شخص واقعاً این اشتراک را می‌خرد و حاضر به پرداخت است.",
                "false": "این شخص نمی‌خرد (به دلیل قیمت، بی‌اعتمادی به دسترسی پیامک بانکی، یا عدم نیاز).",
            },
        }
        for p in PERSONAS_12
    }
    r_flash = call_decider("pplx-decider-flash-v1.3", STIMULUS_FINTECH, q_noul_fa)
    flash_probs = {pid: ans["noul"] for pid, ans in r_flash["data"]["answers"].items()}

    # Pattern D: English Persona + Instructions on Persian Stimulus (v1.3 27B)
    q_noul_en = {
        p["id"]: {
            "type": "noul",
            "instructions": (
                f"Persona: {p['en']}\n"
                "Based on this Iranian person's income, needs, tech comfort, and trust level, "
                "would they actually pay 390,000 Toman/month for this app?"
            ),
            "criteria": {
                "true": "They would genuinely subscribe and pay 390,000 Toman/month.",
                "false": "They would not subscribe (too expensive, privacy distrust, or no need).",
            },
        }
        for p in PERSONAS_12
    }
    r_en = call_decider("pplx-decider-v1.3", STIMULUS_FINTECH, q_noul_en)
    en_probs = {pid: ans["noul"] for pid, ans in r_en["data"]["answers"].items()}

    ids = [p["id"] for p in PERSONAS_12]
    va = [pattern_a_probs[i] for i in ids]
    vb = [pattern_b_probs[i] for i in ids]
    vf = [flash_probs[i] for i in ids]
    ve = [en_probs[i] for i in ids]

    def metrics(ref, cmp_):
        mad = statistics.mean(abs(x - y) for x, y in zip(ref, cmp_))
        sp = spearman_corr(ref, cmp_)
        return mad, sp

    mad_ab, sp_ab = metrics(vb, va)
    mad_fb, sp_fb = metrics(vb, vf)
    mad_fa, sp_fa = metrics(va, vf)
    mad_ea, sp_ea = metrics(va, ve)

    print(f"{'Persona':24s} | {'Batched27B':10s} | {'Isolat27B':10s} | {'Flash 4B':10s} | {'EngInst27B':10s}")
    print("-" * 78)
    for p in PERSONAS_12:
        i = p["id"]
        print(f"{i:24s} | {pattern_a_probs[i]:9.1%} | {pattern_b_probs[i]:9.1%} | {flash_probs[i]:9.1%} | {en_probs[i]:9.1%}")

    print("\nAgreement & Cost Summary:")
    print(f"  Batched27B vs Isolated27B : MAD={mad_ab:.3f} | Spearman={sp_ab:.3f}")
    print(f"  Flash4B    vs Batched27B  : MAD={mad_fa:.3f} | Spearman={sp_fa:.3f}")
    print(f"  Flash4B    vs Isolated27B : MAD={mad_fb:.3f} | Spearman={sp_fb:.3f}")
    print(f"  EnglishIns vs PersianIns  : MAD={mad_ea:.3f} | Spearman={sp_ea:.3f}")
    print(f"  Isolated27B wall={b_wall_ms}ms (median {int(statistics.median(b_latencies))}ms) | total_in_tok={b_tokens} (${b_tokens*0.02/1e6:.6f})")
    u_fl = r_flash["data"].get("usage", {})
    u_en = r_en["data"].get("usage", {})
    print(f"  Flash4B     wall={r_flash['ms']}ms | total_in_tok={u_fl.get('input_tokens',0)} (${u_fl.get('input_tokens',0)*0.01/1e6:.6f})")
    print(f"  EnglishIns  wall={r_en['ms']}ms | total_in_tok={u_en.get('input_tokens',0)} (${u_en.get('input_tokens',0)*0.02/1e6:.6f})")

    return {
        "batched_27b": pattern_a_probs,
        "isolated_27b": pattern_b_probs,
        "flash_4b": flash_probs,
        "english_27b": en_probs,
        "metrics": {
            "mad_batched_vs_isolated": mad_ab,
            "spearman_batched_vs_isolated": sp_ab,
            "mad_flash_vs_batched": mad_fa,
            "spearman_flash_vs_batched": sp_fa,
            "mad_en_vs_fa": mad_ea,
            "spearman_en_vs_fa": sp_ea,
        },
        "isolated_tokens": b_tokens,
        "flash_usage": u_fl,
        "en_usage": u_en,
    }


def exp3_symmetry_and_bias():
    print_header("EXP 3: SYMMETRY, OPTION-ORDER BIAS & FRAMING BIAS IN PERSIAN")
    # Test on 4 diverse personas
    subset = [PERSONAS_12[0], PERSONAS_12[3], PERSONAS_12[6], PERSONAS_12[11]]

    # 3A. Option-order rotation on Coffee Ads (ABC vs BCA vs CAB)
    orders = [
        ("ABC", {"ad_A_luxury": "گزینه A (رسمی و لوکس)", "ad_B_genz": "گزینه B (شوخ و نسل Z)", "ad_C_discount": "گزینه C (تخفیفی، ارسال رایگان و اقساطی)"}),
        ("BCA", {"ad_B_genz": "گزینه B (شوخ و نسل Z)", "ad_C_discount": "گزینه C (تخفیفی، ارسال رایگان و اقساطی)", "ad_A_luxury": "گزینه A (رسمی و لوکس)"}),
        ("CAB", {"ad_C_discount": "گزینه C (تخفیفی، ارسال رایگان و اقساطی)", "ad_A_luxury": "گزینه A (رسمی و لوکس)", "ad_B_genz": "گزینه B (شوخ و نسل Z)"}),
    ]
    order_res = {}
    for tag, crit in orders:
        qs = {
            p["id"]: {
                "type": "choice",
                "instructions": f"شخصیت تو: {p['fa']}\nکدام تبلیغ بیشتر تو را جذب می‌کند؟",
                "criteria": crit,
            }
            for p in subset
        }
        order_res[tag] = call_decider("pplx-decider-v1.3", STIMULUS_COFFEE_ADS, qs)["data"]["answers"]

    print("3A. Option-Order Invariance (ABC vs BCA vs CAB):")
    flips = 0
    max_drift = 0.0
    for p in subset:
        pid = p["id"]
        w_abc = order_res["ABC"][pid]["choice"]
        w_bca = order_res["BCA"][pid]["choice"]
        w_cab = order_res["CAB"][pid]["choice"]
        p_abc = order_res["ABC"][pid]["probabilities"][w_abc]
        p_bca = order_res["BCA"][pid]["probabilities"][w_abc]
        p_cab = order_res["CAB"][pid]["probabilities"][w_abc]
        drift = max(p_abc, p_bca, p_cab) - min(p_abc, p_bca, p_cab)
        max_drift = max(max_drift, drift)
        flipped = len({w_abc, w_bca, w_cab}) > 1
        if flipped:
            flips += 1
        print(f"  {pid:22s}: ABC={w_abc}({p_abc:.2f}) | BCA={w_bca}({p_bca:.2f}) | CAB={w_cab}({p_cab:.2f}) | drift={drift:.3f} {'FLIP!' if flipped else 'STABLE'}")

    # 3B. Negation symmetry & Leading-question bias on Fintech
    q_sym = {}
    for p in subset:
        q_sym[f"{p['id']}__pos"] = {
            "type": "noul",
            "instructions": f"شخصیت تو: {p['fa']}\nآیا اشتراک ماهانه ۳۹۰ هزار تومانی این اپ را می‌خری؟",
        }
        q_sym[f"{p['id']}__neg"] = {
            "type": "noul",
            "instructions": f"شخصیت تو: {p['fa']}\nآیا از خرید اشتراک ماهانه ۳۹۰ هزار تومانی این اپ منصرف می‌شوی و آن را نمی‌خری؟",
        }
        q_sym[f"{p['id']}__hyped"] = {
            "type": "noul",
            "instructions": f"شخصیت تو: {p['fa']}\nآیا این اپلیکیشن فوق‌العاده و کاربردی را با قیمت استثنایی ۳۹۰ هزار تومان می‌خری؟",
        }
    r_sym = call_decider("pplx-decider-v1.3", STIMULUS_FINTECH, q_sym)["data"]["answers"]

    print("\n3B. Negation Symmetry (ideal P(yes)+P(no)=1.00) & Leading/Sycophancy Shift:")
    for p in subset:
        pid = p["id"]
        p_pos = r_sym[f"{pid}__pos"]["noul"]
        p_neg = r_sym[f"{pid}__neg"]["noul"]
        p_hyp = r_sym[f"{pid}__hyped"]["noul"]
        print(
            f"  {pid:22s}: P(buy)={p_pos:.3f} | P(skip)={p_neg:.3f} | sum={p_pos+p_neg:.3f} (err={abs(1-(p_pos+p_neg)):.3f}) | hyped={p_hyp:.3f} (shift={p_hyp-p_pos:+.3f})"
        )

    return {"order_res": order_res, "flips": flips, "max_drift": max_drift, "neg_and_hype": r_sym}


def exp4_persian_locate_heatmap():
    print_header("EXP 4: SECRET WEAPON — PERSIAN `locate` HEATMAP (Triggers vs Red Flags)")
    subset = [PERSONAS_12[0], PERSONAS_12[3], PERSONAS_12[4], PERSONAS_12[7], PERSONAS_12[10], PERSONAS_12[11]]

    qs = {}
    for p in subset:
        qs[f"{p['id']}__trust"] = {
            "type": "locate",
            "instructions": (
                f"شخصیت تو: {p['fa']}\n"
                "دقیقاً کدام بخش یا عبارت از متن باعث ایجاد اعتماد یا رغبت تو به خرید می‌شود؟"
            ),
        }
        qs[f"{p['id']}__redflag"] = {
            "type": "locate",
            "instructions": (
                f"شخصیت تو: {p['fa']}\n"
                "دقیقاً کدام بخش یا عبارت از متن باعث بی‌اعتمادی، شک یا منصرف شدن تو از خرید می‌شود؟"
            ),
        }
    res = call_decider("pplx-decider-v1.3", STIMULUS_LANDING_LOCATE, qs)
    u = res["data"].get("usage", {})
    print(f"Latency: {res['ms']}ms | Tokens: {u.get('input_tokens', 0)} | State length: {len(STIMULUS_LANDING_LOCATE)} chars")

    offset_ok = 0
    offset_total = 0
    for p in subset:
        pid = p["id"]
        trust_spans = res["data"]["answers"][f"{pid}__trust"].get("spans", [])
        flag_spans = res["data"]["answers"][f"{pid}__redflag"].get("spans", [])
        print(f"\n[{p['label']}]")
        for kind, spans in [("  + TRUST  ", trust_spans), ("  - REDFLAG", flag_spans)]:
            if not spans:
                print(f"{kind}: (no spans)")
            for sp in spans[:3]:
                s, e, txt, sc = sp["start"], sp["end"], sp["text"], sp["score"]
                exact = STIMULUS_LANDING_LOCATE[s:e] == txt
                offset_total += 1
                if exact:
                    offset_ok += 1
                print(f"{kind}: ({sc:.2f}) [{s}:{e} {'OK' if exact else 'OFFSET_MISMATCH'}] «{txt}»")

    print(f"\nUnicode Persian Offset Verification: {offset_ok}/{offset_total} exact matches")
    return res


def make_test_ad_banner(style: str) -> str:
    """Create a clean 640x360 PNG visual ad mockup (base64 data URL) to verify multimodal image decisions."""
    img = Image.new("RGB", (640, 360), color=(15, 20, 30) if style == "luxury" else (210, 25, 35))
    draw = ImageDraw.Draw(img)
    try:
        font_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40)
        font_med = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except Exception:
        font_big = ImageFont.load_default()
        font_med = ImageFont.load_default()

    if style == "luxury":
        # Minimalist dark gold card
        draw.rectangle([24, 24, 616, 336], outline=(212, 175, 55), width=3)
        draw.text((55, 70), "NORA SPECIALTY COFFEE", fill=(212, 175, 55), font=font_big)
        draw.text((55, 145), "Single Origin Ethiopia - 100% Arabica", fill=(235, 235, 235), font=font_med)
        draw.text((55, 210), "Price: 680,000 Toman (250g)", fill=(200, 200, 200), font=font_med)
        draw.text((55, 270), "Minimal luxury packaging | Express Tehran", fill=(160, 160, 160), font=font_med)
    else:
        # Loud red flash sale card
        draw.rectangle([16, 16, 624, 344], outline=(255, 240, 0), width=8)
        draw.rectangle([40, 40, 600, 125], fill=(255, 230, 0))
        draw.text((70, 58), "MEGA SALE 70% OFF TODAY!", fill=(200, 0, 0), font=font_big)
        draw.text((55, 155), "ONLY 199,000 TOMAN + FREE SHIPPING!", fill=(255, 255, 255), font=font_med)
        draw.text((55, 210), "4 Installments SnappPay - 0% Interest", fill=(255, 245, 150), font=font_med)
        draw.text((55, 275), "HURRY!! LAST 3 PACKS LEFT!!", fill=(255, 255, 255), font=font_med)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def exp5_multimodal_ad_creatives():
    print_header("EXP 5: MULTIMODAL IMAGE CREATIVE A/B TEST (Dark Luxury vs Loud Flash Sale)")
    img_lux = make_test_ad_banner("luxury")
    img_sale = make_test_ad_banner("flash_sale")

    state = [
        "دو بنر تبلیغاتی اینستاگرام برای فروش قهوه در بازار ایران:\nبنر اول (تصویر ۱ - سبک مینیمال لوکس):",
        {"type": "image_url", "image_url": {"url": img_lux}},
        "بنر دوم (تصویر ۲ - سبک حراج قرمز و اقساطی):",
        {"type": "image_url", "image_url": {"url": img_sale}},
    ]
    subset = [PERSONAS_12[0], PERSONAS_12[1], PERSONAS_12[3], PERSONAS_12[4], PERSONAS_12[5], PERSONAS_12[11]]
    qs = {
        p["id"]: {
            "type": "choice",
            "instructions": f"شخصیت تو: {p['fa']}\nکدام بنر تبلیغاتی بیشتر تو را جذب و قانع به کلیک روی آگهی می‌کند؟",
            "criteria": {
                "banner_1_luxury": "بنر اول (تیره، مینیمال، لوکس، ۶۸۰ هزار تومان)",
                "banner_2_flash_sale": "بنر دوم (قرمز و زرد، ۷۰٪ تخفیف، ۱۹۹ هزار تومان، اقساطی)",
                "neither": "هیچ‌کدام برایم جذاب نیست",
            },
        }
        for p in subset
    }
    res = call_decider("pplx-decider-v1.3", state, qs)
    u = res["data"].get("usage", {})
    cost = u.get("input_tokens", 0) * 0.02 / 1e6
    print(f"Latency: {res['ms']}ms | Tokens (2 images + 6 personas): {u.get('input_tokens', 0)} | Cost: ${cost:.6f}")
    for p in subset:
        ans = res["data"]["answers"][p["id"]]
        probs = ", ".join(f"{k}={v:.0%}" for k, v in ans["probabilities"].items())
        print(f"  {p['label']:34s} -> {ans['choice']:19s} ({probs})")
    return res


def generate_100_iranian_personas():
    cities = [
        ("تهران (شمال)", "کلان‌شهر مرفه"),
        ("تهران (مرکز و جنوب)", "کلان‌شهر پرتراکم"),
        ("مشهد", "کلان‌شهر مذهبی/توریستی"),
        ("اصفهان", "کلان‌شهر سنتی/صنعتی"),
        ("شیراز", "کلان‌شهر فرهنگی"),
        ("تبریز", "کلان‌شهر تجاری"),
        ("کرج", "حومه پرجمعیت تهران"),
        ("اهواز", "شهر صنعتی جنوب"),
        ("رشت", "شهر شمال کشور"),
        ("قم", "شهر مذهبی"),
        ("کرمان", "مرکز استان"),
        ("یزد", "شهر سنتی و اقتصادی"),
        ("سنندج", "مرکز استان غرب"),
        ("بوشهر", "شهر بندری جنوب"),
        ("زاهدان", "شهر شرق کشور"),
        ("شهرستان کوچک", "شهر زیر ۵۰ هزار نفر"),
    ]
    jobs_incomes = [
        ("دانشجو", "۷ میلیون تومان", "خیلی حساس به قیمت، اهل تخفیف"),
        ("کارمند بخش خصوصی", "۲۶ میلیون تومان", "متوسط، استفاده روزانه از اپ‌ها"),
        ("کارمند دولت", "۱۹ میلیون تومان", "محافظه‌کار، علاقه‌مند به خرید اقساطی"),
        ("برنامه‌نویس/تک", "۷۵ میلیون تومان", "دیجیتال‌نیتیو، حساس به کیفیت و حریم خصوصی"),
        ("مغازه‌دار/بازاری", "۶۰ میلیون تومان", "سنتی، شکاک به استارتاپ‌های ناشناس"),
        ("خانه‌دار", "بودجه خانوار ۲۸ میلیون", "مدیریت هزینه خانواده، عاشق ارسال رایگان و اینماد"),
        ("راننده اسنپ/آزاد", "۲۲ میلیون تومان", "درآمد روزانه، تحت فشار تورم"),
        ("صاحب آنلاین‌شاپ", "۴۲ میلیون تومان", "فعال اینستاگرام، نیازمند ابزار سریع"),
        ("پزشک/وکیل", "۱۴۰ میلیون تومان", "کم‌وقت، کیفیت‌گرا، بی‌حوصله برای تبلیغ شلوغ"),
        ("بازنشسته", "۱۵ میلیون تومان", "کم‌اعتماد به پرداخت آنلاین، طرفدار پشتیبانی تلفنی"),
        ("فریلنسر/طراح", "۳۲ میلیون تومان", "زیبایی‌شناس، درآمد متغیر"),
        ("مهندس صنعت", "۵۵ میلیون تومان", "منطقی، تحلیل‌گر قبل از خرید"),
    ]
    genders = ["زن", "مرد"]
    ages = [19, 22, 25, 28, 31, 34, 37, 41, 45, 50, 56, 62]
    traits = [
        "زود به برندهای جدید اعتماد می‌کند اگر طراحی حرفه‌ای باشد",
        "بدون اینماد و نظرات دیجی‌کالا خرید نمی‌کند",
        "خرید اقساطی اسنپ‌پی/دیجی‌پی برایش عامل تعیین‌کننده است",
        "به شدت نسبت به حفظ حریم خصوصی و دسترسی‌های گوشی حساس است",
        "معمولاً بر اساس توصیه دوستان و کانال‌های تلگرام تصمیم می‌گیرد",
        "همیشه دنبال ارزش خرید بالا و مقایسه قیمت در ترب است",
    ]
    personas = []
    for i in range(100):
        city, city_type = cities[i % len(cities)]
        job, inc, jtrait = jobs_incomes[(i * 7 + i // len(cities)) % len(jobs_incomes)]
        age = ages[(i * 5 + 3) % len(ages)]
        gender = genders[i % 2]
        trait = traits[(i * 3 + 1) % len(traits)]
        personas.append({
            "id": f"c{i+1:03d}",
            "city": city,
            "age": age,
            "gender": gender,
            "job": job,
            "income": inc,
            "desc": f"{gender} {age} ساله، ساکن {city} ({city_type})، شغل: {job} (درآمد: {inc}). {jtrait}. {trait}.",
        })
    return personas


def exp6_scale_100_and_hybrid_deepseek():
    print_header("EXP 6: 100-PERSONA CROWD STRESS TEST + SYSTEM 2 HYBRID (DeepSeek Flash)")
    crowd = generate_100_iranian_personas()

    # 6A. Run 100 personas in ONE single request to pplx-decider-v1.3
    qs_100 = {
        p["id"]: {
            "type": "noul",
            "instructions": f"شخصیت: {p['desc']}\nآیا حاضر است اشتراک ماهانه ۳۹۰ هزار تومانی اپلیکیشن کیف‌یار را بخرد؟",
        }
        for p in crowd
    }
    r100 = call_decider("pplx-decider-v1.3", STIMULUS_FINTECH, qs_100, timeout=90)
    u100 = r100["data"].get("usage", {})
    cost100_usd = u100.get("input_tokens", 0) * 0.02 / 1e6

    # Also test 2x50 in parallel for latency comparison
    t0 = time.perf_counter()
    qs_a = {p["id"]: qs_100[p["id"]] for p in crowd[:50]}
    qs_b = {p["id"]: qs_100[p["id"]] for p in crowd[50:]}
    with ThreadPoolExecutor(max_workers=2) as ex:
        fa = ex.submit(call_decider, "pplx-decider-v1.3", STIMULUS_FINTECH, qs_a, None, 90)
        fb = ex.submit(call_decider, "pplx-decider-v1.3", STIMULUS_FINTECH, qs_b, None, 90)
        ra, rb = fa.result(), fb.result()
    ms_2x50 = round((time.perf_counter() - t0) * 1000)
    tok_2x50 = ra["data"].get("usage", {}).get("input_tokens", 0) + rb["data"].get("usage", {}).get("input_tokens", 0)

    # Also test 100 personas on Flash v1.3
    r100_flash = call_decider("pplx-decider-flash-v1.3", STIMULUS_FINTECH, qs_100, timeout=90)
    u100_fl = r100_flash["data"].get("usage", {})
    cost100_fl = u100_fl.get("input_tokens", 0) * 0.01 / 1e6

    probs = [(p, r100["data"]["answers"][p["id"]]["noul"]) for p in crowd]
    probs.sort(key=lambda x: x[1], reverse=True)
    vals = [v for _, v in probs]
    yes_50 = sum(1 for v in vals if v >= 0.5)
    soft_30 = sum(1 for v in vals if 0.3 <= v < 0.5)
    no_30 = sum(1 for v in vals if v < 0.3)

    print(f"100 Personas in ONE call (v1.3 27B):      {r100['ms']:5d}ms | {u100.get('input_tokens', 0):6d} tok | ${cost100_usd:.6f}")
    print(f"100 Personas in 2x50 parallel (v1.3 27B): {ms_2x50:5d}ms | {tok_2x50:6d} tok | ${tok_2x50*0.02/1e6:.6f}")
    print(f"100 Personas in ONE call (Flash 4B):      {r100_flash['ms']:5d}ms | {u100_fl.get('input_tokens', 0):6d} tok | ${cost100_fl:.6f}")
    print(f"\n100-Persona Crowd Distribution (Fintech 390k Toman/mo):")
    print(f"  Mean buy prob: {statistics.mean(vals):.1%} | Median: {statistics.median(vals):.1%} | Std: {statistics.stdev(vals):.1%}")
    print(f"  Likely Buy (>=50%): {yes_50}% | Fence-Sitters (30-50%): {soft_30}% | Unlikely (<30%): {no_30}%")
    print(f"  Top 3 Buyers:")
    for p, v in probs[:3]:
        print(f"    {v:5.1%} | {p['id']} | {p['job']} ({p['city']}, {p['age']}yo, {p['income']})")
    print(f"  Bottom 3 Skeptics:")
    for p, v in probs[-3:]:
        print(f"    {v:5.1%} | {p['id']} | {p['job']} ({p['city']}, {p['age']}yo, {p['income']})")

    # Segment rollup by job
    by_job = {}
    for p, v in probs:
        by_job.setdefault(p["job"], []).append(v)
    print("\n  Segment Average by Occupation:")
    for job, vs in sorted(by_job.items(), key=lambda kv: statistics.mean(kv[1]), reverse=True):
        print(f"    {job:22s}: {statistics.mean(vs):5.1%} (n={len(vs)})")

    # 6B. System 2 Qualitative Interviews via DeepSeek Flash (thinking=False vs True)
    print("\n6B. System 2 DeepSeek-Flash Follow-up Interviews (Top Buyer, Fence-Sitter, Hard Skeptic):")
    picks = [
        ("BUYER", probs[0][0], probs[0][1]),
        ("UNDECIDED", min(probs, key=lambda x: abs(x[1] - 0.5))[0], min(probs, key=lambda x: abs(x[1] - 0.5))[1]),
        ("SKEPTIC", probs[-1][0], probs[-1][1]),
    ]
    interviews = []
    for role, persona, prob in picks:
        stance = "تمایل بالا به خرید" if prob >= 0.6 else ("مردد بین خرید و نخریدن" if prob >= 0.35 else "مخالف خرید")
        msgs = [
            {
                "role": "system",
                "content": (
                    f"تو نقش این شخص واقعی ایرانی را بازی می‌کنی: {persona['desc']}\n"
                    f"در نظرسنجی قبلی درباره محصول زیر، میزان احتمال خرید تو {prob:.0%} ({stance}) بوده است.\n"
                    "مثل یک ایرانی واقعی، صمیمی، محاوره‌ای و کوتاه (حداکثر ۳ جمله) دلیل نظرت را بگو و یک پیشنهاد مشخص بده که چه تغییری نظرت را بهتر می‌کند. از لحن رباتیک و رسمی پرهیز کن."
                ),
            },
            {
                "role": "user",
                "content": f"{STIMULUS_FINTECH}\n\nچرا این نظر رو داشتی؟ دقیقاً چه چیزی تو رو جذب یا منصرف کرد و اگه قرار بود تغییری بدن چی نظرت رو عوض می‌کرد؟",
            },
        ]
        ds = call_deepseek(msgs, max_tokens=220, thinking=False)
        txt = ds["data"]["choices"][0]["message"]["content"].strip()
        usage = ds["data"].get("usage", {})
        print(f"\n  [{role} | p={prob:.0%} | {ds['ms']}ms | {usage.get('total_tokens',0)} tok] {persona['job']} - {persona['city']} ({persona['age']}yo):")
        print(f"  » {txt}")
        interviews.append({"role": role, "persona": persona, "prob": prob, "ms": ds["ms"], "usage": usage, "reply": txt})

    return {
        "r100_ms": r100["ms"],
        "r100_usage": u100,
        "r2x50_ms": ms_2x50,
        "r100_flash_ms": r100_flash["ms"],
        "r100_flash_usage": u100_fl,
        "distribution": {"mean": statistics.mean(vals), "median": statistics.median(vals), "std": statistics.stdev(vals), "yes_50": yes_50, "soft_30": soft_30, "no_30": no_30},
        "interviews": interviews,
    }


def main():
    all_results = {}
    all_results["exp1"], pattern_a_probs = exp1_persona_sensitivity()
    all_results["exp2"] = exp2_architecture_showdown(pattern_a_probs)
    all_results["exp3"] = exp3_symmetry_and_bias()
    all_results["exp4"] = exp4_persian_locate_heatmap()
    all_results["exp5"] = exp5_multimodal_ad_creatives()
    all_results["exp6"] = exp6_scale_100_and_hybrid_deepseek()

    out_path = RESULTS_DIR / "lab_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\nSaved complete raw results to {out_path}")


if __name__ == "__main__":
    main()
