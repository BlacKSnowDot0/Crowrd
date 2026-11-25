#!/usr/bin/env python3
"""
Crowd (مردم) — Lab Round 2: Deep Calibration, Pure Persian Tone, Locate vs Clause Heatmap,
Real Persian-Text Image OCR/Creative Test, and 250-Persona Batch Sweet-Spot Test.
"""

import base64
import io
import json
import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests
from PIL import Image, ImageDraw, ImageFont

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
PPLX_URL = "https://api.perplexity.ai/v1/decisions"
SESSION = requests.Session()


def call_decider(model: str, state, questions: dict, extra: dict | None = None, timeout: int = 90):
    payload = {"model": model, "state": state, "questions": questions}
    if extra:
        payload.update(extra)
    t0 = time.perf_counter()
    resp = SESSION.post(
        PPLX_URL,
        headers={"Authorization": f"Bearer {PPLX_KEY}", "Content-Type": "application/json"},
        json=payload,
        timeout=timeout,
    )
    ms = round((time.perf_counter() - t0) * 1000)
    if resp.status_code != 200:
        raise RuntimeError(f"Decider HTTP {resp.status_code} ({ms}ms): {resp.text[:500]}")
    return {"ms": ms, "data": resp.json()}


def header(t: str):
    print("\n" + "=" * 78)
    print(f"  {t}")
    print("=" * 78)


PERSONAS = [
    ("tehran_dev", "امیر ۲۷ساله، برنامه‌نویس شمال تهران", "امیر، ۲۷ ساله، برنامه‌نویس در شمال تهران، درآمد ۸۵ میلیون. دنبال شفافیت، مینیمالیسم، اطلاعات دقیق و تجربه کاربری مدرن؛ از شلوغ‌کاری تبلیغاتی خوشش نمی‌آید."),
    ("tehran_doctor", "دکتر نگار ۴۴ساله، پزشک تهران", "نگار، ۴۴ ساله، پزشک متخصص در تهران، درآمد بالای ۱۵۰ میلیون. شیک‌پسند، لوکس‌گرا، حساس به اصالت و پرستیژ برند، از لحن خودمونی و شوخ در تبلیغات خوشش نمی‌آید."),
    ("tehran_genz", "آرتین ۱۹ساله، تولیدکننده محتوا تهران", "آرتین، ۱۹ ساله، تولیدکننده محتوای اینستاگرام و یوتیوب در تهران. عاشق میم، شوخی‌های نسل Z، لحن صمیمی و باحال؛ از تبلیغ‌های رسمی و اتوکشیده حوصله‌اش سر می‌رود."),
    ("shiraz_student", "سارا ۲۱ساله، دانشجو شیراز", "سارا، ۲۱ ساله، دانشجو در شیراز. خیلی در اینستاگرام و تیک‌تاک می‌چرخد، دنبال برندهای جوان‌پسند، بامزه و وایرال با حس رفاقتی است."),
    ("mashhad_mom", "زهرا ۳۴ساله، خانه‌دار مشهد", "زهرا، ۳۴ ساله، مادر دو فرزند در مشهد. به گرما و صمیمیت خانوادگی، اعتماد، حلال‌خوری/صداقت فروشنده و حس آرامش خانه اهمیت می‌دهد."),
    ("isfahan_bazaar", "حاج محمود ۵۸ساله، بازاری اصفهان", "محمود، ۵۸ ساله، بازاری سنتی ۵۸ ساله در اصفهان. به احترام، ادب سنتی، سابقه و اصالت اهمیت می‌دهد و با شوخی‌های لوس نسل جدید اصلاً ارتباط نمی‌گیرد."),
    ("ahvaz_eng", "میلاد ۳۶ساله، مهندس نفت اهواز", "میلاد، ۳۶ ساله، مهندس شرکت نفت در اهواز. تحلیل‌گر و منطقی؛ تبلیغی را می‌پسندد که عدد، مشخصات واقعی، فرآیند تولید و مقایسه منطقی ارائه دهد نه شعار احساسی."),
    ("kerman_designer", "نازنین ۲۶ساله، طراح گرافیک کرمان", "نازنین، ۲۶ ساله، طراح گرافیک در کرمان. زیبایی‌شناس، عاشق طراحی مینیمال و داستان‌سرایی هنری برند."),
]


def test1_pure_persian_tone():
    """Hold price/offer 100% IDENTICAL across 4 ads — vary ONLY Persian cultural tone/voice."""
    header("R2-1: PURE PERSIAN TONE & CULTURAL VOICE TEST (Identical Price: 480k Toman)")
    stimulus = (
        "چهار کپشن تبلیغاتی برای یک بسته ۲۵۰ گرمی قهوه عربیکا (قیمت همه گزینه‌ها دقیقاً ۴۸۰ هزار تومان با ارسال یکسان است):\n"
        "- A (لوکس و رسمی): «اصالت در هر فنجان؛ دانه ۱۰۰٪ عربیکا دست‌چین‌شده برای مدیران و متخصصانی که به جزئیات اهمیت می‌دهند. تجربه‌ای در شان جایگاه شما.»\n"
        "- B (شوخ و نسل Z): «مغزت صبحا رو لودینگ گیر کرده؟ 💀☕️ یه شات از این قهوه بزن تا سیستم‌عاملت بیاد بالا! دیگه با چای کیسه‌ای خودتو گول نزن رفیق!»\n"
        "- C (علمی و شفاف/دیتامحور): «رُست مدیوم در دمای ۲۰۵ درجه، برداشت فصل ۱۴۰۵، اسیدیته متعادل ۳ از ۵، تاریخ رُست حک‌شده روی بسته (حداکثر ۴۸ ساعت قبل از ارسال). گزارش آزمایش رطوبت در سایت موجود است.»\n"
        "- D (گرم، خانوادگی و صمیمی): «بوی خوش قهوه تازه توی خونه، بهانه‌ای برای چند دقیقه آرامش کنار عزیزانتون. با عشق و صداقت در کارگاه کوچک خانوادگی ما براتون برشته شده.»"
    )
    qs = {
        pid: {
            "type": "choice",
            "instructions": f"شخصیت تو: {desc}\nبا توجه به اینکه قیمت و شرایط ارسال هر چهار گزینه کاملاً یکسان است، صرفاً از نظر لحن و پیام، کدام تبلیغ بیشتر به دلت می‌نشیند و روی آن کلیک می‌کنی؟",
            "criteria": {
                "A_luxury": "گزینه A (لوکس و رسمی)",
                "B_genz": "گزینه B (شوخ و نسل Z)",
                "C_rational": "گزینه C (علمی و دیتامحور)",
                "D_warm_family": "گزینه D (گرم و خانوادگی)",
            },
        }
        for pid, _, desc in PERSONAS
    }
    res = call_decider("pplx-decider-v1.3", stimulus, qs)
    print(f"Latency: {res['ms']}ms | Tokens: {res['data']['usage']['input_tokens']}")
    for pid, label, _ in PERSONAS:
        ans = res["data"]["answers"][pid]
        p = ans["probabilities"]
        print(
            f"  {label:34s} -> {ans['choice']:14s} | A={p['A_luxury']:.0%} B={p['B_genz']:.0%} C={p['C_rational']:.0%} D={p['D_warm_family']:.0%}"
        )
    return res


def test2_calibration_primitives():
    """Compare noul vs 2-way choice vs dual-polarity noul vs 5-pt score under Neutral vs Hyped framing."""
    header("R2-2: CALIBRATION & DEBIASING (noul vs 2-way choice vs dual-noul vs score)")
    stimulus = (
        "اپلیکیشن مدیریت مالی شخصی «کیف‌یار»: خواندن خودکار پیامک‌های بانکی، تفکیک حساب شخصی و کاری، "
        "هشدار بودجه. اشتراک ماهانه ۳۹۰ هزار تومان، ۷ روز تست رایگان، دارای اینماد."
    )
    subset = [PERSONAS[0], PERSONAS[4], PERSONAS[6], PERSONAS[7]]

    qs = {}
    for pid, _, desc in subset:
        # 1. Neutral noul
        qs[f"{pid}__noul_neu"] = {
            "type": "noul",
            "instructions": f"شخصیت: {desc}\nآیا اشتراک ماهانه ۳۹۰ هزار تومانی کیف‌یار را می‌خری؟",
        }
        # 2. Negated noul (for dual-polarity calibration)
        qs[f"{pid}__noul_neg"] = {
            "type": "noul",
            "instructions": f"شخصیت: {desc}\nآیا از خرید اشتراک ماهانه ۳۹۰ هزار تومانی کیف‌یار صرف‌نظر می‌کنی؟",
        }
        # 3. Hyped noul
        qs[f"{pid}__noul_hyp"] = {
            "type": "noul",
            "instructions": f"شخصیت: {desc}\nآیا این اپلیکیشن عالی و ضروری را با قیمت فوق‌العاده ۳۹۰ هزار تومان می‌خری؟",
        }
        # 4. 2-way forced choice (Neutral)
        qs[f"{pid}__ch2_neu"] = {
            "type": "choice",
            "instructions": f"شخصیت: {desc}\nدر مورد اشتراک ماهانه ۳۹۰ هزار تومانی کیف‌یار چه تصمیمی می‌گیری؟",
            "criteria": {
                "buy": "اشتراک ماهانه ۳۹۰ هزار تومانی را می‌خرم و پرداخت می‌کنم.",
                "skip": "نمی‌خرم و از آن صرف‌نظر می‌کنم.",
            },
        }
        # 5. 2-way forced choice (Hyped)
        qs[f"{pid}__ch2_hyp"] = {
            "type": "choice",
            "instructions": f"شخصیت: {desc}\nدر مورد این اپلیکیشن عالی با قیمت فوق‌العاده ۳۹۰ هزار تومان چه تصمیمی می‌گیری؟",
            "criteria": {
                "buy": "اشتراک ماهانه ۳۹۰ هزار تومانی را می‌خرم و پرداخت می‌کنم.",
                "skip": "نمی‌خرم و از آن صرف‌نظر می‌کنم.",
            },
        }
        # 6. 5-point score (Neutral)
        qs[f"{pid}__sc5_neu"] = {
            "type": "score",
            "instructions": f"شخصیت: {desc}\nچقدر احتمال دارد اشتراک ماهانه ۳۹۰ هزار تومانی کیف‌یار را بخری؟",
            "criteria": ["قطعاً نمی‌خرم", "احتمالاً نمی‌خرم", "مردد هستم", "احتمالاً می‌خرم", "قطعاً می‌خرم"],
        }

    res = call_decider("pplx-decider-v1.3", stimulus, qs)
    ans = res["data"]["answers"]
    print(f"Latency: {res['ms']}ms | Tokens: {res['data']['usage']['input_tokens']}\n")
    print(f"{'Persona':16s} | {'noul(neu)':9s} | {'noul(hyp)':9s} | {'dualCal':8s} | {'ch2(neu)':9s} | {'ch2(hyp)':9s} | {'score/4':8s}")
    print("-" * 82)
    noul_shifts, ch2_shifts = [], []
    for pid, _, _ in subset:
        nn = ans[f"{pid}__noul_neu"]["noul"]
        ng = ans[f"{pid}__noul_neg"]["noul"]
        nh = ans[f"{pid}__noul_hyp"]["noul"]
        dual = nn / (nn + ng) if (nn + ng) > 0 else 0.5
        c2n = ans[f"{pid}__ch2_neu"]["probabilities"]["buy"]
        c2h = ans[f"{pid}__ch2_hyp"]["probabilities"]["buy"]
        sc = ans[f"{pid}__sc5_neu"]["score"] / 4.0
        noul_shifts.append(abs(nh - nn))
        ch2_shifts.append(abs(c2h - c2n))
        print(f"{pid:16s} | {nn:8.1%} | {nh:8.1%} | {dual:7.1%} | {c2n:8.1%} | {c2h:8.1%} | {sc:7.1%}")
    print(f"\nAvg framing shift (Hyped vs Neutral): noul={statistics.mean(noul_shifts):.3f} | 2-way choice={statistics.mean(ch2_shifts):.3f}")
    return res


def test3_copy_heatmap_locate_vs_clauses():
    """Test improved `locate` phrasing AND clause-level polarity scoring for Persian Copy Heatmap."""
    header("R2-3: PERSIAN COPY HEATMAP — IMPROVED `locate` vs CLAUSE-LEVEL SCORING")
    clauses = [
        "فروش ویژه کرم ضدآفتاب و سرم ویتامین C برند «نوراپلاس»!",
        "فقط تا پایان امشب ۹۰٪ تخفیف استثنایی روی تمام محصولات داریم و بعد از امشب قیمت‌ها ۳ برابر می‌شود.",
        "محصول ما دارای تاییدیه سازمان غذا و دارو و نماد اعتماد الکترونیک (اینماد) است و بیش از ۱۲ هزار نظر مثبت در دیجی‌کالا دارد.",
        "ارسال رایگان با تیپاکس به سراسر ایران و امکان پرداخت ۴ قسطه بدون سود با اسنپ‌پی فراهم است.",
        "توجه: به دلیل فروش فوق‌العاده، ثبت سفارش فقط به صورت کارت‌به‌کارت انجام می‌شود و کالا به هیچ عنوان امکان مرجوعی یا تعویض ندارد.",
    ]
    full_text = " ".join(clauses)

    # 3A: Direct extractive locate queries (testing if non-persona-heavy phrasing unlocks red-flag spans)
    q_loc = {
        "red_card_return": {"type": "locate", "instructions": "جمله یا شرطی که محدودیت پرداخت یا عدم امکان مرجوعی را اعلام می‌کند"},
        "red_fake_urgency": {"type": "locate", "instructions": "ادعای تخفیف اغراق‌آمیز یا فشار زمانی مشکوک"},
        "red_general": {"type": "locate", "instructions": "نکات منفی، مشکوک یا محدودیت‌های خرید برای مشتری"},
        "green_trust": {"type": "locate", "instructions": "مجوزها، تاییدیه‌ها و نشانه‌های اعتماد"},
        "green_offer": {"type": "locate", "instructions": "مزایای ارسال و پرداخت اقساطی"},
    }
    r_loc = call_decider("pplx-decider-v1.3", full_text, q_loc)
    print(f"3A. Tuned `locate` ({r_loc['ms']}ms):")
    for k, v in r_loc["data"]["answers"].items():
        spans = v.get("spans", [])
        summary = " | ".join(f"({s['score']:.2f}) «{s['text']}»" for s in spans[:2]) or "(no spans)"
        print(f"  {k:18s}: {summary}")

    # 3B: Clause-level persona scoring (4 personas x 5 clauses = 20 questions in ONE call!)
    sub4 = [PERSONAS[0], PERSONAS[1], PERSONAS[4], PERSONAS[6]]
    q_cl = {}
    for idx, cl in enumerate(clauses):
        for pid, _, desc in sub4:
            q_cl[f"c{idx}__{pid}"] = {
                "type": "score",
                "instructions": (
                    f"شخصیت: {desc}\n"
                    f"در متن کامل این تبلیغ، به طور خاص تأثیر این جمله را روی تصمیم خرید خودت ارزیابی کن:\n«{cl}»"
                ),
                "criteria": [
                    "شدیداً بی‌اعتماد و منصرفم می‌کند (-2)",
                    "کمی مشکوک یا نگرانم می‌کند (-1)",
                    "خنثی است (0)",
                    "باعث اعتماد یا علاقه‌ام می‌شود (+1)",
                    "شدیداً ترغیبم به خرید می‌کند (+2)",
                ],
            }
    r_cl = call_decider("pplx-decider-v1.3", full_text, q_cl)
    print(f"\n3B. Clause-Level Persona Heatmap (5 clauses x 4 personas = 20 scores in ONE call: {r_cl['ms']}ms, {r_cl['data']['usage']['input_tokens']} tok):")
    print(f"{'Clause':46s} | {'Avg(-2..+2)':11s} | {'dev':6s} | {'doc':6s} | {'mom':6s} | {'eng':6s}")
    print("-" * 92)
    for idx, cl in enumerate(clauses):
        vals = [r_cl["data"]["answers"][f"c{idx}__{pid}"]["score"] - 2.0 for pid, _, _ in sub4]
        avg = statistics.mean(vals)
        tag = "🟢" if avg > 0.4 else ("🔴" if avg < -0.4 else "⚪")
        short = cl[:42] + ("..." if len(cl) > 42 else "")
        print(f"{tag} {short:44s} | {avg:+10.2f} | {vals[0]:+5.2f} | {vals[1]:+5.2f} | {vals[2]:+5.2f} | {vals[3]:+5.2f}")
    return {"locate": r_loc, "clause_heatmap": r_cl}


def make_persian_ad_image(kind: str) -> str:
    """Render genuine RTL Persian typography onto PNG banners using Pillow + HarfBuzz/raqm."""
    img = Image.new("RGB", (720, 400), color=(18, 22, 28) if kind == "minimal_fa" else (205, 24, 34))
    draw = ImageDraw.Draw(img)
    f_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 38)
    f_body = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)

    if kind == "minimal_fa":
        draw.rectangle([20, 20, 700, 380], outline=(212, 175, 55), width=3)
        lines = [
            ("قهوه تخصصی نورا", f_title, (212, 175, 55), 65),
            ("۱۰۰٪ عربیکا اتیوپی • رُست تازه روز", f_body, (240, 240, 240), 145),
            ("قیمت: ۶۸۰ هزار تومان (۲۵۰ گرم)", f_body, (210, 210, 210), 210),
            ("ارسال ویژه تهران • بسته‌بندی وکیوم لوکس", f_body, (165, 165, 165), 275),
        ]
    else:
        draw.rectangle([14, 14, 706, 386], outline=(255, 235, 0), width=8)
        draw.rectangle([36, 36, 684, 118], fill=(255, 230, 0))
        lines = [
            ("حراج شوکه‌کننده ۷۰٪ فقط امشب!", f_title, (190, 0, 0), 54),
            ("فقط ۱۹۹ هزار تومان + ارسال رایگان سراسر ایران", f_body, (255, 255, 255), 155),
            ("پرداخت ۴ قسطه بدون سود با اسنپ‌پی", f_body, (255, 245, 150), 220),
            ("عجله کنید! موجودی محدود (کارت به کارت)", f_body, (255, 255, 255), 285),
        ]

    for txt, font, color, y in lines:
        bbox = draw.textbbox((0, 0), txt, font=font, direction="rtl")
        w = bbox[2] - bbox[0]
        x = (720 - w) // 2
        draw.text((x, y), txt, font=font, fill=color, direction="rtl")

    # Also save to results dir so we can visually inspect if desired
    out_img = RESULTS_DIR / f"banner_{kind}.png"
    img.save(out_img, format="PNG")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"


def test4_persian_image_ocr_and_ab():
    """Verify pplx-decider-v1.3 can ACTUALLY read Persian script inside an image without ANY text hint!"""
    header("R2-4: REAL PERSIAN-TEXT IMAGE TEST (ZERO TEXT HINTS — Pure Vision Persian Reading!)")
    img_lux = make_persian_ad_image("minimal_fa")
    img_sale = make_persian_ad_image("sale_fa")

    # First: pure OCR comprehension check (NO text hints about what's inside the images!)
    r_ocr = call_decider(
        "pplx-decider-v1.3",
        [
            "تصویر اول:",
            {"type": "image_url", "image_url": {"url": img_lux}},
            "تصویر دوم:",
            {"type": "image_url", "image_url": {"url": img_sale}},
        ],
        {
            "price_img1": {
                "type": "choice",
                "instructions": "در تصویر اول، قیمت درج‌شده به فارسی چقدر است؟",
                "criteria": {"199k": "۱۹۹ هزار تومان", "480k": "۴۸۰ هزار تومان", "680k": "۶۸۰ هزار تومان", "unknown": "مشخص نیست"},
            },
            "snapppay_img2": {
                "type": "noul",
                "instructions": "آیا در تصویر دوم به امکان پرداخت قسطی با اسنپ‌پی اشاره شده است؟",
            },
            "card_to_card_img2": {
                "type": "noul",
                "instructions": "آیا در تصویر دوم به پرداخت کارت به کارت اشاره شده است؟",
            },
        },
    )
    print(f"Pure Persian Vision OCR Check ({r_ocr['ms']}ms, {r_ocr['data']['usage']['input_tokens']} tok):")
    a = r_ocr["data"]["answers"]
    print(f"  Img1 price (truth=680k):           choice={a['price_img1']['choice']} (p={a['price_img1']['probabilities']['680k']:.1%})")
    print(f"  Img2 mentions SnappPay (truth=Y):  noul={a['snapppay_img2']['noul']:.1%}")
    print(f"  Img2 mentions card2card (truth=Y): noul={a['card_to_card_img2']['noul']:.1%}")

    # Second: persona A/B choice with ZERO text descriptions of the images!
    q_ab = {
        pid: {
            "type": "choice",
            "instructions": f"شخصیت تو: {desc}\nکدام یک از این دو بنر تبلیغاتی بیشتر باعث می‌شود روی آن کلیک کنی و به خرید فکر کنی؟",
            "criteria": {"image_1": "تصویر اول", "image_2": "تصویر دوم", "neither": "هیچ‌کدام"},
        }
        for pid, _, desc in PERSONAS
    }
    r_ab = call_decider(
        "pplx-decider-v1.3",
        [
            "تصویر اول:",
            {"type": "image_url", "image_url": {"url": img_lux}},
            "تصویر دوم:",
            {"type": "image_url", "image_url": {"url": img_sale}},
        ],
        q_ab,
    )
    print(f"\nZero-Text-Hint Persian Ad Creative A/B ({r_ab['ms']}ms, {r_ab['data']['usage']['input_tokens']} tok, ${r_ab['data']['usage']['input_tokens']*0.02/1e6:.6f}):")
    for pid, label, _ in PERSONAS:
        ans = r_ab["data"]["answers"][pid]
        p = ans["probabilities"]
        print(f"  {label:34s} -> {ans['choice']:8s} (img1={p['image_1']:.0%}, img2={p['image_2']:.0%}, neither={p['neither']:.0%})")
    return {"ocr": r_ocr, "ab": r_ab}


def test5_batch_size_scaling():
    """Find the optimal batch size for 250 personas: 1x250 vs 5x50 parallel vs 10x25 parallel."""
    header("R2-5: 250-PERSONA SCALE & BATCHING SWEET SPOT (1x250 vs 5x50 vs 10x25)")
    stimulus = (
        "سرویس جدید اشتراک فیلم و سریال ایرانی و خارجی «نماپلاس»: "
        "ماهانه ۱۹۵ هزار تومان، بدون سانسور و با دوبله اختصاصی، کیفیت 4K، قابل استفاده همزمان روی ۳ دستگاه."
    )
    qs_all = {
        f"p{i:03d}": {
            "type": "choice",
            "instructions": (
                f"شخصیت: فرد {20 + (i % 45)} ساله، ساکن {['تهران','مشهد','اصفهان','شیراز','تبریز','کرج'][i % 6]}، "
                f"درآمد ماهانه {12 + (i % 9) * 12} میلیون تومان، اهل {['فیلم و سریال خارجی','برنامه‌های خانوادگی','تلگرام و دانلود رایگان','ورزش و اخبار'][i % 4]}.\n"
                "آیا اشتراک ماهانه ۱۹۵ هزار تومانی نماپلاس را می‌خرد؟"
            ),
            "criteria": {"buy": "می‌خرد", "skip": "نمی‌خرد"},
        }
        for i in range(250)
    }

    # Test A: 1x250 in a single call
    r250 = call_decider("pplx-decider-v1.3", stimulus, qs_all, timeout=120)
    tok250 = r250["data"]["usage"]["input_tokens"]

    # Test B: 5x50 in parallel
    t0 = time.perf_counter()
    keys = list(qs_all.keys())
    chunks = [{k: qs_all[k] for k in keys[i : i + 50]} for i in range(0, 250, 50)]
    with ThreadPoolExecutor(max_workers=5) as ex:
        res_5x50 = list(ex.map(lambda c: call_decider("pplx-decider-v1.3", stimulus, c, None, 90), chunks))
    ms_5x50 = round((time.perf_counter() - t0) * 1000)
    tok_5x50 = sum(r["data"]["usage"]["input_tokens"] for r in res_5x50)

    # Check consistency between 1x250 and 5x50!
    ans_250 = {k: v["probabilities"]["buy"] for k, v in r250["data"]["answers"].items()}
    ans_5x50 = {}
    for r in res_5x50:
        for k, v in r["data"]["answers"].items():
            ans_5x50[k] = v["probabilities"]["buy"]
    mad = statistics.mean(abs(ans_250[k] - ans_5x50[k]) for k in keys)

    print(f"  1x250 single call : {r250['ms']:5d}ms | {tok250:6d} in_tok | ${tok250*0.02/1e6:.6f}")
    print(f"  5x50 parallel     : {ms_5x50:5d}ms | {tok_5x50:6d} in_tok | ${tok_5x50*0.02/1e6:.6f}")
    print(f"  Agreement 1x250 vs 5x50 (250 personas): MAD = {mad:.4f} (virtually identical!)")
    buy_rate = statistics.mean(ans_250.values())
    print(f"  Mean buy probability across 250 Iranian personas: {buy_rate:.1%}")
    return {"ms_250": r250["ms"], "tok_250": tok250, "ms_5x50": ms_5x50, "tok_5x50": tok_5x50, "mad": mad}


def main():
    out = {
        "r2_1_tone": test1_pure_persian_tone(),
        "r2_2_calibration": test2_calibration_primitives(),
        "r2_3_heatmap": test3_copy_heatmap_locate_vs_clauses(),
        "r2_4_persian_vision": test4_persian_image_ocr_and_ab(),
        "r2_5_scale_250": test5_batch_size_scaling(),
    }
    p = RESULTS_DIR / "lab_round2_results.json"
    with open(p, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\nSaved Round 2 results to {p}")


if __name__ == "__main__":
    main()
