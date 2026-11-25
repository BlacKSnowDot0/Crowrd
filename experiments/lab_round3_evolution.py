#!/usr/bin/env python3
"""
Crowd (مردم) — Lab Round 3:
1. Way C ("10 Deep Personas in state, 60 cross-referenced metric questions") vs Way B (Isolated 1 persona/call) accuracy check!
2. Shallow vs Deep Iranian Profile sensitivity check.
3. Live Diagnostic-Guided Evolution Test (g0 -> g1 -> g2 -> Unseen Holdout Crowd) on a Persian Ad!
"""

import json
import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np
import requests

ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = ROOT / "experiments" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

for line in open(ROOT / ".env", encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ[k] = v

PPLX_KEY = os.environ["PERPLEXITY_API_KEY"]
DEEPSEEK_KEY = os.environ["DEEPSEEK_API_KEY"]
SESSION = requests.Session()


def call_decider(state, questions: dict, model="pplx-decider-v1.3", timeout=90):
    t0 = time.perf_counter()
    resp = SESSION.post(
        "https://api.perplexity.ai/v1/decisions",
        headers={"Authorization": f"Bearer {PPLX_KEY}", "Content-Type": "application/json"},
        json={"model": model, "state": state, "questions": questions},
        timeout=timeout,
    )
    ms = round((time.perf_counter() - t0) * 1000)
    if resp.status_code != 200:
        raise RuntimeError(f"Decider HTTP {resp.status_code} ({ms}ms): {resp.text[:500]}")
    return {"ms": ms, "data": resp.json()}


def call_deepseek(messages: list, max_tokens=1200, temperature=0.7, json_mode=False):
    payload = {
        "model": "deepseek-flash",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "thinking": {"type": "disabled"},
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    t0 = time.perf_counter()
    resp = SESSION.post(
        "https://api.deepseek.com/chat/completions",
        headers={"Authorization": f"Bearer {DEEPSEEK_KEY}", "Content-Type": "application/json"},
        json=payload,
        timeout=90,
    )
    ms = round((time.perf_counter() - t0) * 1000)
    if resp.status_code != 200:
        raise RuntimeError(f"DeepSeek HTTP {resp.status_code} ({ms}ms): {resp.text[:500]}")
    return {"ms": ms, "data": resp.json()}


def spearman(xs, ys):
    rx = np.argsort(np.argsort(xs)).astype(float)
    ry = np.argsort(np.argsort(ys)).astype(float)
    if np.std(rx) == 0 or np.std(ry) == 0:
        return 0.0
    return float(np.corrcoef(rx, ry)[0, 1])


# 10 REALLY DEEP, hyper-realistic Iranian profiles (representing diverse slices of Iran)
DEEP_PROFILES_10 = [
    {
        "id": "P01",
        "name": "آرش کریمی",
        "city": "تهران (یوسف‌آباد)",
        "age": 31,
        "job": "توسعه‌دهنده ارشد بک‌اند",
        "shallow": "مرد ۳۱ ساله برنامه‌نویس در تهران با درآمد ۹۵ میلیون تومان، اهل ورزش و خرید آنلاین.",
        "deep": (
            "آرش کریمی، ۳۱ ساله، مجرد، مستاجر در یوسف‌آباد تهران. برنامه‌نویس ارشد در یک شرکت فین‌تک با درآمد ماهانه ۹۵ میلیون تومان (۳۲ میلیون اجاره، بقیه پس‌انداز طلا و تتر). "
            "ساعت کاریش فشرده است و صبح‌ها با عجله با اسنپ می‌رود سر کار؛ شب‌ها خسته برمی‌گردد و حوصله باشگاه رفتن ندارد با اینکه ۴ کیلو اضافه وزن گرفته و کمرش از نشستن زیاد درد می‌کند. "
            "آیفون ۱۵ دارد، اینستاگرام و توییتر/اکس و تلگرام می‌چرخد، ولی از تبلیغات زرد و اغراق‌آمیز ایرانی متنفر است و سریع رد می‌کند. "
            "پارسال اشتراک یک اپ ورزشی خرید ولی چون برنامه‌اش تکراری و کند بود بعد از دو هفته پاک کرد؛ برای همین به «۷۲٪ موفقیت» و «شعار سال جدید» خیلی بدبین است مگر توضیح فنی و واقعی ببیند و بتواند قبل از پول دادن تست کند."
        ),
    },
    {
        "id": "P02",
        "name": "مریم حسینی",
        "city": "مشهد (قاسم‌آباد)",
        "age": 35,
        "job": "خانه‌دار و حسابدار پاره‌وقت",
        "shallow": "زن ۳۵ ساله متاهل در مشهد با دو فرزند و بودجه خانوار ۳۴ میلیون تومان.",
        "deep": (
            "مریم حسینی، ۳۵ ساله، متاهل با دو بچه ۵ و ۹ ساله در قاسم‌آباد مشهد. همسرش کارمند بخش خصوصی است و کل درآمد خانوار ۳۴ میلیون تومان است که با قسط وام مسکن و هزینه مدرسه دقیقاً سر به سر می‌شود. "
            "بعد از زایمان دوم دوست دارد در خانه روزی ۱۵ دقیقه ورزش کند چون نه پول باشگاه دارد نه کسی که بچه‌ها را نگه دارد. "
            "زیاد در اینستاگرام و ایتا می‌چرخد، خریدهایش را از دیجی‌کالا و باسلام و با اسنپ‌پی قسطی انجام می‌دهد. "
            "به شدت به حریم خصوصی و دوربین گوشی حساس است—وقتی می‌شنود یک اپ می‌خواهد «با دوربین گوشی حرکاتت را بشمارد» فوراً نگران فیلم‌برداری و لو رفتن حریم شخصی در خانه می‌شود! همچنین بدون اینماد و نظر واقعی کاربران در کافه‌بازار یا مایکت پول نمی‌دهد."
        ),
    },
    {
        "id": "P03",
        "name": "پارسا شریفی",
        "city": "شیراز (معالی‌آباد)",
        "age": 22,
        "job": "دانشجوی مهندسی و ادمین پیج",
        "shallow": "پسر ۲۲ ساله دانشجو در شیراز با درآمد ۱۲ میلیون تومان، فعال در اینستاگرام.",
        "deep": (
            "پارسا شریفی، ۲۲ ساله، دانشجوی ترم ۶ مهندسی کامپیوتر در شیراز، با خانواده زندگی می‌کند و از ادمینی دو پیج اینستاگرام ماهی ۱۲ میلیون تومان درمی‌آورد. "
            "خیلی سریع در ریلز اینستاگرام اسکرول می‌کند (کمتر از ۱.۵ ثانیه برای هر تبلیغ وقت می‌گذارد). فقط چیزهایی متوقفش می‌کند که یا بامزه و خلاقانه باشد یا عدد/چالش مشخص و خیلی ارزان داشته باشد. "
            "عاشق بدنسازی است اما هزینه باشگاه ماهانه ۱.۵ میلیون برایش سنگین شده و دنبال جایگزین خانگی یا برنامه تمرینی هوشمند است. اگر ماه اول مثلاً ۴۹ هزار تومان باشد سریع کنجکاو می‌شود، ولی از متن‌های طولانی و رسمی حوصله‌اش سر می‌رود."
        ),
    },
    {
        "id": "P04",
        "name": "دکتر سمیرا راد",
        "city": "تهران (الهیه)",
        "age": 43,
        "job": "دندانپزشک",
        "shallow": "زن ۴۳ ساله دندانپزشک در شمال تهران با درآمد ۲۲۰ میلیون تومان.",
        "deep": (
            "دکتر سمیرا راد، ۴۳ ساله، دندانپزشک با مطب شخصی در شمال تهران و درآمد بالای ۲۰۰ میلیون تومان. "
            "کل روز در مطب خم می‌شود و گردن‌درد و خستگی شدید دارد؛ بین بیماران یا شب ساعت ۱۰ فقط ۲۰ دقیقه وقت آزاد دارد. "
            "کیفیت، طراحی شیک، علمی بودن برنامه (زیر نظر فیزیوتراپ یا مربی معتبر) و احترام به شخصیتش برایش مهم است. "
            "وقتی می‌بیند تبلیغی می‌گوید «تخفیف فقط تا یکشنبه» یا لحنش شبیه پیامک‌های تبلیغاتی ارزان است، حس بی‌کیفیتی می‌گیرد و رد می‌کند. قیمت برایش اصلاً مساله نیست—اعتماد، علمی بودن و صرفه‌جویی در وقت همه‌چیز است."
        ),
    },
    {
        "id": "P05",
        "name": "مرتضی زارع",
        "city": "اصفهان (ملک‌شهر)",
        "age": 48,
        "job": "فروشنده لوازم یدکی خودرو",
        "shallow": "مرد ۴۸ ساله مغازه‌دار در اصفهان با درآمد ۵۵ میلیون تومان.",
        "deep": (
            "مرتضی زارع، ۴۸ ساله، متاهل، صاحب مغازه لوازم یدکی در ملک‌شهر اصفهان با درآمد حدود ۵۵ میلیون تومان. "
            "دکترش به تازگی به خاطر کبد چرب و چربی خون گفته باید وزن کم کند و تحرک داشته باشد، اما از صبح تا ۸ شب مغازه است و اصلاً وقت پیاده‌روی و باشگاه ندارد. "
            "حوصله اصطلاحات انگلیسی و تکنولوژی پیچیده ندارد؛ گوشی سامسونگ میان‌رده دارد و بیشتر در تلگرام و اینستاگرام ویدیو می‌بیند. "
            "دو بار قبلاً در اینستاگرام پکیج لاغری خریده و کلاه سرش رفته، بنابراین به هر تبلیغی که وعده سریع یا آمار عجیب بدهد شدیداً بدبین است. اگر ببیند ساده، فارسی، واقعی و بدون ریسک (مثلاً ۷ روز رایگان بدون کارت بانکی) است، شاید امتحان کند."
        ),
    },
    {
        "id": "P06",
        "name": "یلدا مرادی",
        "city": "تبریز (ولیعصر)",
        "age": 27,
        "job": "طراح UI/UX فریلنسر",
        "shallow": "زن ۲۷ ساله طراح در تبریز با درآمد ۳۸ میلیون تومان.",
        "deep": (
            "یلدا مرادی، ۲۷ ساله، مجرد، طراح محصول فریلنسر در تبریز با درآمد متغیر حدود ۳۸ میلیون تومان. "
            "دورکاری می‌کند و گاهی ۳ روز از خانه بیرون نمی‌رود؛ می‌داند باید روزی ۱۵ دقیقه ورزش کند ولی همیشه انگیزه‌اش وسط هفته می‌خوابد. "
            "دقیقاً عاشق ایده‌ی یک همراه هوشمند و باحال است که «یادآوری و پیگیری» کند تا رها نکند، اما از عبارت‌های آزاردهنده مثل «بهت غر می‌زنه» یا فشار استرس‌زا خوشش نمی‌آید؛ ترجیح می‌دهد حس گیمیفیکیشن، پیشرفت واقعی و طراحی تمیز ببیند. "
            "قبل از نصب اپ، حتماً می‌پرسد با گوشی اندروید و بدون فیلترشکن کار می‌کند یا نه."
        ),
    },
    {
        "id": "P07",
        "name": "بهرام قاسمی",
        "city": "کرج (گوهردشت)",
        "age": 38,
        "job": "کارمند بانک",
        "shallow": "مرد ۳۸ ساله کارمند بانک در کرج با حقوق ۲۹ میلیون تومان.",
        "deep": (
            "بهرام قاسمی، ۳۸ ساله، متاهل با یک فرزند، کارمند بانک در کرج با حقوق ۲۹ میلیون تومان و دو قسط همزمان. "
            "به خاطر شغل بانکی ذهن بسیار جزئی‌نگر و محافظه‌کاری دارد؛ سریع به جزئیات مبهم مشکوک می‌شود (مثلاً «ماه اول ۴۹ هزار تومان — بعدش چقدر میشه؟ نکنه ماه دوم یهو ۵۰۰ هزار تومن خودکار کم کنه؟»). "
            "عصرها خیلی خسته به خانه می‌رسد و دلش می‌خواهد کمی فرم بدنش بهتر شود ولی برای هر هزینه اشتراکی دو بار فکر می‌کند و متن تبلیغ را با عینک «نکنه تله اشتراک تمدید خودکار باشه» می‌خواند."
        ),
    },
    {
        "id": "P08",
        "name": "فاطمه اکبری",
        "city": "قم (صفائیه)",
        "age": 29,
        "job": "معلم ابتدایی",
        "shallow": "زن ۲۹ ساله معلم در قم با حقوق ۱۶ میلیون تومان.",
        "deep": (
            "فاطمه اکبری، ۲۹ ساله، متاهل، معلم دبستان در قم با حقوق ۱۶ میلیون تومان. "
            "علاقه‌مند به پیلاتس و ورزش سبک در خانه است چون رفتن به باشگاه با برنامه مدرسه و کار خانه سخت است. "
            "عمدتاً در ایتا و اینستاگرام حضور دارد. مسئله دوربین گوشی در خانه برایش خط قرمز مطلق است (حتی اگر بگویند هوش مصنوعی است، تا مطمئن نشود فیلم هیچ‌جا ارسال و ذخیره نمی‌شود و بدون اینترنت هم کار می‌کند، محال است دوربین را روشن کند). "
            "لحن محترمانه، آرام و صادقانه را خیلی بیشتر از لحن تهاجمی و آمریکایی می‌پسندد."
        ),
    },
    {
        "id": "P09",
        "name": "کیانوش فرهادی",
        "city": "اهواز (کیانپارس)",
        "age": 34,
        "job": "مهندس تعمیرات شرکت نفت",
        "shallow": "مرد ۳۴ ساله مهندس در اهواز با درآمد ۷۲ میلیون تومان.",
        "deep": (
            "کیانوش فرهادی، ۳۴ ساله، مهندس شرکت نفت در اهواز با شیفت‌های دو هفته کار / دو هفته استراحت و درآمد ۷۲ میلیون تومان. "
            "در منطقه عملیاتی که دو هفته می‌ماند باشگاه درست‌وحسابی ندارد و دقیقاً به یک برنامه ۱۵ دقیقه‌ای بدون نیاز به تجهیزات در اتاق خوابگاه نیاز دارد! "
            "آدم عملی و نتیجه‌گراست: برایش مهم است بفهمد برنامه دقیقاً برای سطح بدنی او شخصی‌سازی می‌شود، آفلاین هم کار می‌کند یا نه، و آیا حرکت‌ها را درست آموزش می‌دهد تا آسیب نبیند."
        ),
    },
    {
        "id": "P10",
        "name": "مهسا نادری",
        "city": "رشت (گلسار)",
        "age": 25,
        "job": "فروشنده آنلاین پوشاک در اینستاگرام",
        "shallow": "زن ۲۵ ساله صاحب آنلاین‌شاپ در رشت با درآمد ۴۰ میلیون تومان.",
        "deep": (
            "مهسا نادری، ۲۵ ساله، مجرد، صاحب پیج فروش شال و مانتو در رشت با درآمد ۴۰ میلیون تومان. "
            "روزی ۶ ساعت در اینستاگرام کار می‌کند و خودش تبلیغ می‌گذارد، بنابراین دست همه‌ی تبلیغ‌نویس‌های کلیشه‌ای را از دور می‌خواند! "
            "شعارهای تکراری مثل «سال جدید، آدم جدید» برایش فوق‌العاده خز و اسکرول‌ردکنی است. "
            "چیزی متوقفش می‌کند که مستقیم دست بگذارد روی درد واقعی‌اش (تنبلی، وسط راه ول کردن ورزش، حس گناه) و یک راهکار ملموس و مدرن نشان دهد."
        ),
    },
]

# Also 6 UNSEEN Holdout Deep Profiles (NEVER seen during evolution optimization!)
HOLDOUT_PROFILES_6 = [
    {
        "id": "H01",
        "name": "سهیل رضایی",
        "city": "تهران (ستارخان)",
        "age": 29,
        "job": "مدیر محصول استارتاپ",
        "deep": (
            "سهیل رضایی، ۲۹ ساله، مدیر محصول در ستارخان تهران با درآمد ۶۸ میلیون تومان. روزی ۱۰ ساعت پشت لپ‌تاپ است، ۳ بار اشتراک باشگاه گرفته و فقط ماه اول رفته. "
            "خیلی به عدد و شفافیت قیمت حساس است؛ اگر ببیند هزینه ماه دوم مخفی شده یا ادعای علمی بی‌سند است، فوری رد می‌کند. دنبال ابزار فارسی، سریع و بدون فیلترشکن است."
        ),
    },
    {
        "id": "H02",
        "name": "نرگس موسوی",
        "city": "اصفهان (مرداویج)",
        "age": 37,
        "job": "معمار و مادر یک کودک",
        "deep": (
            "نرگس موسوی، ۳۷ ساله، معمار پاره‌وقت و مادر یک پسر ۶ ساله در اصفهان، درآمد خانوار ۵۲ میلیون تومان. فقط صبح زود ۱۵ دقیقه وقت ورزش در خانه دارد. "
            "شدیداً نسبت به حریم خصوصی دوربین حساس است مگر مطمئن شود پردازش کاملاً روی خود گوشی انجام می‌شود و فیلمی آپلود نمی‌شود."
        ),
    },
    {
        "id": "H03",
        "name": "امید طاهری",
        "city": "شیراز (صدرا)",
        "age": 26,
        "job": "تکنسین برق و نصاب",
        "deep": (
            "امید طاهری، ۲۶ ساله، نصاب سیستم‌های هوشمند در شیراز با درآمد ۲۵ میلیون تومان. اینستاگرام زیاد می‌بیند، حوصله متن طولانی ندارد. "
            "اگر قیمت روشن و منصفانه باشد و اولش بشود رایگان امتحان کرد، سریع تست می‌کند."
        ),
    },
    {
        "id": "H04",
        "name": "شیوا بهرامی",
        "city": "کرج (مهرشهر)",
        "age": 41,
        "job": "مدیر منابع انسانی",
        "deep": (
            "شیوا بهرامی، ۴۱ ساله، مدیر HR در مهرشهر کرج با درآمد ۷۵ میلیون تومان. دیسک خفیف کمر دارد و دنبال تمرین ایمن، کوتاه و اصولی در خانه است. "
            "از تبلیغات زرد و فشار «فقط تا امشب» بیزار است و به اصالت، تخصص مربی/فیزیوتراپ و تجربه رایگان شفاف اعتماد می‌کند."
        ),
    },
    {
        "id": "H05",
        "name": "حمیدرضا جلالی",
        "city": "مشهد (وکیل‌آباد)",
        "age": 52,
        "job": "کارمند ارشد دولتی",
        "deep": (
            "حمیدرضا جلالی، ۵۲ ساله، کارمند ارشد در مشهد با حقوق ۲۶ میلیون تومان. پزشک گفته باید روزی ۲۰ دقیقه ورزش کند. "
            "تکنولوژی را در حد متوسط بلد است و از اشتراک‌های خودکار و کلاهبرداری‌های اینستاگرامی می‌ترسد. دنبال اینماد، سادگی و توضیح شفاف است."
        ),
    },
    {
        "id": "H06",
        "name": "تارا کاظمی",
        "city": "تهران (پاسداران)",
        "age": 23,
        "job": "دانشجوی ارشد و بلاگر سبک زندگی",
        "deep": (
            "تارا کاظمی، ۲۳ ساله، دانشجوی ارشد در پاسداران تهران، درآمد ۲۰ میلیون از تولید محتوا. "
            "خیلی به زیبایی لحن، صداقت برند و حس مدرن اهمیت می‌دهد؛ شعارهای کلیشه‌ای انگیزشی را در نیم ثانیه رد می‌کند."
        ),
    },
]

# Initial weak Persian Ad (modeled right after the PeakFit ad in the user's video, localized to Iran!)
AD_G0 = {
    "headline": "سال جدید، همون آدم قبلی؟ این بار نه!",
    "body": "فیت‌یار برات برنامه می‌سازه، با دوربین گوشی تعداد حرکت‌هات رو می‌شماره و اونقدر پیگیرت میشه تا ورزش کنی. روزی ۱۵ دقیقه بدون نیاز به باشگاه. ۷۲٪ اعضا تا ماه سوم همچنان ادامه میدن.",
    "cta": "ماه اول فقط ۴۹ هزار تومان — فقط تا یکشنبه",
}

PRODUCT_TRUTH = (
    "واقعیت‌های واقعی محصول «فیت‌یار» (فقط از این حقایق واقعی استفاده کن و چیز دروغین نساز):\n"
    "- اپلیکیشن ایرانی تمرین خانگی ۱۵ دقیقه‌ای بدون نیاز به باشگاه و تجهیزات\n"
    "- برنامه شخصی‌سازی‌شده بر اساس سطح بدنی و محدودیت‌های حرکتی (طراحی‌شده زیر نظر مربیان دارای مدرک)\n"
    "- شمارش هوشمند حرکت با دوربین گوشی (کاملاً اختیاری + پردازش ۱۰۰٪ روی خود گوشی بدون ارسال یا ذخیره هیچ فیلمی در سرور)\n"
    "- یادآوری هوشمند و سیستم پیگیری روزانه (گیمیفیکیشن) بدون نیاز به فیلترشکن، قابل اجرا روی اندروید و iOS\n"
    "- دارای اینماد و امتیاز ۴.۷ در کافه‌بازار\n"
    "- قیمت واقعی و شفاف: ۷ روز تست کاملاً رایگان بدون نیاز به کارت بانکی، سپس ماه اول ۴۹ هزار تومان و از ماه دوم ۱۴۹ هزار تومان در ماه (لغو آنی با یک کلیک، بدون تمدید اجباری)"
)


def format_ad(ad: dict) -> str:
    return f"تیتر: {ad['headline']}\nمتن: {ad['body']}\nدکمه (CTA): {ad['cta']}"


def build_metric_questions_for_cohort(profiles: list, mode="way_c"):
    """6 metrics per persona: stop_scroll, would_click, buy_intent, trust, clarity, reaction."""
    qs = {}
    for p in profiles:
        pid = p["id"]
        prefix = f"بر اساس پروفایل دقیق شخص {pid} ({p['name']}):" if mode == "way_c" else f"شخصیت: {p['deep']}\n"
        qs[f"{pid}__stop"] = {
            "type": "choice",
            "instructions": f"{prefix} هنگام اسکرول اینستاگرام، آیا با دیدن این تبلیغ مکث می‌کند و آن را می‌خواند؟",
            "criteria": {"yes": "مکث می‌کند و می‌خواند", "no": "سریع رد می‌کند"},
        }
        qs[f"{pid}__click"] = {
            "type": "choice",
            "instructions": f"{prefix} آیا روی دکمه این تبلیغ کلیک می‌کند؟",
            "criteria": {"yes": "کلیک می‌کند", "no": "کلیک نمی‌کند"},
        }
        qs[f"{pid}__intent"] = {
            "type": "choice",
            "instructions": f"{prefix} آیا واقعاً اپلیکیشن را نصب/تست یا خریداری می‌کند؟",
            "criteria": {"yes": "اقدام به تست یا خرید می‌کند", "no": "اقدامی نمی‌کند"},
        }
        qs[f"{pid}__trust"] = {
            "type": "choice",
            "instructions": f"{prefix} آیا به این تبلیغ و ادعاهایش اعتماد می‌کند (بدون شک به کلاهبرداری یا نقض حریم خصوصی)؟",
            "criteria": {"yes": "اعتماد می‌کند", "no": "مشکوک یا بی‌اعتماد است"},
        }
        qs[f"{pid}__clarity"] = {
            "type": "choice",
            "instructions": f"{prefix} آیا دقیقاً متوجه می‌شود این محصول چیست، چطور کار می‌کند و شرایطش چیست؟",
            "criteria": {"yes": "کاملاً واضح است", "no": "مبهم یا دارای سوال بی‌پاسخ است"},
        }
        qs[f"{pid}__reaction"] = {
            "type": "choice",
            "instructions": f"{prefix} حس لحظه‌ای این شخص بعد از دیدن این تبلیغ چیست؟",
            "criteria": {
                "annoyed": "کلافه، بی‌اعتماد یا بی‌تفاوت",
                "neutral": "خنثی",
                "curious": "کنجکاو",
                "excited": "هیجان‌زده و آماده اقدام",
            },
        }
    return qs


def score_crowd_way_c(ad: dict, profiles: list):
    """Evaluate N deep profiles x 6 metrics in ONE Decider call using Way C (Mini-Cohort in state)."""
    state = {
        "تبلیغ_مورد_ارزیابی": ad,
        "پروفایل‌های_مخاطبان": {p["id"]: p["deep"] for p in profiles},
    }
    qs = build_metric_questions_for_cohort(profiles, mode="way_c")
    res = call_decider(state, qs)
    ans = res["data"]["answers"]
    per_person = []
    for p in profiles:
        pid = p["id"]
        stop = ans[f"{pid}__stop"]["probabilities"]["yes"]
        click = ans[f"{pid}__click"]["probabilities"]["yes"]
        intent = ans[f"{pid}__intent"]["probabilities"]["yes"]
        trust = ans[f"{pid}__trust"]["probabilities"]["yes"]
        clarity = ans[f"{pid}__clarity"]["probabilities"]["yes"]
        rx = ans[f"{pid}__reaction"]["choice"]
        fitness = (click * 0.35 + intent * 0.30 + trust * 0.20 + stop * 0.10 + clarity * 0.05) * 100
        per_person.append({
            "id": pid,
            "name": p["name"],
            "city": p["city"],
            "age": p["age"],
            "job": p["job"],
            "stop": stop,
            "click": click,
            "intent": intent,
            "trust": trust,
            "clarity": clarity,
            "reaction": rx,
            "fitness": fitness,
        })
    agg = {
        "fitness": statistics.mean(x["fitness"] for x in per_person),
        "stop": statistics.mean(x["stop"] for x in per_person) * 100,
        "click": statistics.mean(x["click"] for x in per_person) * 100,
        "intent": statistics.mean(x["intent"] for x in per_person) * 100,
        "trust": statistics.mean(x["trust"] for x in per_person) * 100,
        "clarity": statistics.mean(x["clarity"] for x in per_person) * 100,
        "reactions": {r: sum(1 for x in per_person if x["reaction"] == r) for r in ["annoyed", "neutral", "curious", "excited"]},
        "ms": res["ms"],
        "input_tokens": res["data"]["usage"]["input_tokens"],
        "cost_usd": res["data"]["usage"]["input_tokens"] * 0.02 / 1e6,
        "per_person": per_person,
    }
    return agg


def test1_way_c_vs_isolated():
    print("\n" + "=" * 78)
    print("  R3-1: WAY C (10 DEEP PROFILES IN 1 STATE x 6 METRICS) vs ISOLATED (1 PERSON/CALL)")
    print("=" * 78)
    way_c = score_crowd_way_c(AD_G0, DEEP_PROFILES_10)

    # Way B: 10 isolated calls (each call has ONLY 1 persona + ad in state, 6 questions)
    t0 = time.perf_counter()
    def eval_one(p):
        st = {"تبلیغ_مورد_ارزیابی": AD_G0, "پروفایل_مخاطب": p["deep"]}
        qs = {
            "stop": {"type": "choice", "instructions": "آیا هنگام اسکرول اینستاگرام مکث می‌کند و می‌خواند؟", "criteria": {"yes": "مکث می‌کند", "no": "رد می‌کند"}},
            "click": {"type": "choice", "instructions": "آیا روی دکمه این تبلیغ کلیک می‌کند؟", "criteria": {"yes": "کلیک می‌کند", "no": "کلیک نمی‌کند"}},
            "intent": {"type": "choice", "instructions": "آیا واقعاً اپلیکیشن را نصب/تست یا خریداری می‌کند؟", "criteria": {"yes": "اقدام می‌کند", "no": "اقدامی نمی‌کند"}},
            "trust": {"type": "choice", "instructions": "آیا به این تبلیغ و ادعاهایش اعتماد می‌کند؟", "criteria": {"yes": "اعتماد می‌کند", "no": "بی‌اعتماد است"}},
            "clarity": {"type": "choice", "instructions": "آیا دقیقاً متوجه محصول و شرایطش می‌شود؟", "criteria": {"yes": "واضح است", "no": "مبهم است"}},
            "reaction": {"type": "choice", "instructions": "حس لحظه‌ای او چیست؟", "criteria": {"annoyed": "کلافه/بی‌اعتماد", "neutral": "خنثی", "curious": "کنجکاو", "excited": "هیجان‌زده"}},
        }
        r = call_decider(st, qs)
        a = r["data"]["answers"]
        return p["id"], {
            "stop": a["stop"]["probabilities"]["yes"],
            "click": a["click"]["probabilities"]["yes"],
            "intent": a["intent"]["probabilities"]["yes"],
            "trust": a["trust"]["probabilities"]["yes"],
            "clarity": a["clarity"]["probabilities"]["yes"],
            "reaction": a["reaction"]["choice"],
            "tok": r["data"]["usage"]["input_tokens"],
        }

    iso_map = {}
    with ThreadPoolExecutor(max_workers=5) as ex:
        for pid, d in ex.map(eval_one, DEEP_PROFILES_10):
            iso_map[pid] = d
    iso_ms = round((time.perf_counter() - t0) * 1000)
    iso_tok = sum(d["tok"] for d in iso_map.values())

    print(f"Way C (1 call, 60 decisions):  {way_c['ms']:4d}ms | {way_c['input_tokens']:5d} tok | ${way_c['cost_usd']:.6f}")
    print(f"Way B (10 isolated calls):     {iso_ms:4d}ms | {iso_tok:5d} tok | ${iso_tok*0.02/1e6:.6f}\n")

    print(f"{'Persona':22s} | {'Click C/B':13s} | {'Trust C/B':13s} | {'Rx C vs B':20s}")
    print("-" * 76)
    for x in way_c["per_person"]:
        b = iso_map[x["id"]]
        print(f"{x['id']} {x['name']:18s} | {x['click']:5.0%} vs {b['click']:4.0%} | {x['trust']:5.0%} vs {b['trust']:4.0%} | {x['reaction']:8s} vs {b['reaction']:8s}")

    for m in ["stop", "click", "intent", "trust", "clarity"]:
        vc = [x[m] for x in way_c["per_person"]]
        vb = [iso_map[x["id"]][m] for x in way_c["per_person"]]
        mad = statistics.mean(abs(a - b) for a, b in zip(vc, vb))
        sp = spearman(vc, vb)
        print(f"  Metric {m:8s}: MAD={mad:.3f} | Spearman={sp:.3f}")
    rx_match = sum(1 for x in way_c["per_person"] if x["reaction"] == iso_map[x["id"]]["reaction"])
    print(f"  Exact Reaction Match: {rx_match}/10")
    return way_c, iso_map


def test2_shallow_vs_deep():
    print("\n" + "=" * 78)
    print("  R3-2: SHALLOW (1-LINE) vs DEEP (150-WORD) IRANIAN PROFILES ON SAME AD")
    print("=" * 78)
    # Use isolated calls to compare pure profile depth cleanly
    def run_depth(key):
        state = {"تبلیغ": AD_G0, "پروفایل‌ها": {p["id"]: p[key] for p in DEEP_PROFILES_10}}
        qs = {
            f"{p['id']}__trust": {
                "type": "choice",
                "instructions": f"بر اساس پروفایل {p['id']}، آیا به این تبلیغ (از جمله شمارش با دوربین و آمار ۷۲٪) اعتماد می‌کند؟",
                "criteria": {"yes": "اعتماد می‌کند", "no": "مشکوک یا بی‌اعتماد است"},
            }
            for p in DEEP_PROFILES_10
        }
        r = call_decider(state, qs)
        return {p["id"]: r["data"]["answers"][f"{p['id']}__trust"]["probabilities"]["yes"] for p in DEEP_PROFILES_10}

    sh = run_depth("shallow")
    dp = run_depth("deep")
    print(f"{'Persona':24s} | {'Shallow Trust':14s} | {'Deep Trust':11s} | {'Delta':8s}")
    print("-" * 68)
    for p in DEEP_PROFILES_10:
        pid = p["id"]
        print(f"{pid} {p['name']:20s} | {sh[pid]:13.1%} | {dp[pid]:10.1%} | {dp[pid]-sh[pid]:+7.1%}")
    print(f"\nSpread (Std): Shallow={statistics.stdev(sh.values()):.1%} vs Deep={statistics.stdev(dp.values()):.1%}")
    print(f"Mean Trust:   Shallow={statistics.mean(sh.values()):.1%} vs Deep={statistics.mean(dp.values()):.1%}")
    return {"shallow": sh, "deep": dp}


def diagnose_and_mutate(champion_ad: dict, eval_res: dict, gen_num: int):
    """Run clause heatmap + 3 annoyed-persona micro-objections, then ask DeepSeek to produce 2 strategic Persian ad variants."""
    # 1. Clause-level heatmap on champion ad sentences (1 call ~350ms)
    clauses = [
        champion_ad["headline"],
        *[s.strip() for s in champion_ad["body"].replace("؟", "؟|").replace("!", "!|").replace(".", ".|").split("|") if s.strip()],
        champion_ad["cta"],
    ]
    q_heat = {}
    sample_4 = [DEEP_PROFILES_10[0], DEEP_PROFILES_10[1], DEEP_PROFILES_10[4], DEEP_PROFILES_10[6]]
    for ci, cl in enumerate(clauses):
        for p in sample_4:
            q_heat[f"c{ci}__{p['id']}"] = {
                "type": "score",
                "instructions": f"بر اساس پروفایل {p['id']} ({p['name']})، تأثیر این جمله روی تصمیمش چیست: «{cl}»",
                "criteria": ["شدیداً بی‌اعتماد/منصرف (-2)", "کمی منفی (-1)", "خنثی (0)", "مثبت (+1)", "شدیداً ترغیب‌کننده (+2)"],
            }
    r_heat = call_decider(
        {"تبلیغ": format_ad(champion_ad), "پروفایل‌ها": {p["id"]: p["deep"] for p in sample_4}},
        q_heat,
    )
    clause_scores = []
    for ci, cl in enumerate(clauses):
        avg = statistics.mean(r_heat["data"]["answers"][f"c{ci}__{p['id']}"]["score"] - 2.0 for p in sample_4)
        clause_scores.append((cl, round(avg, 2)))

    # 2. Pick 3 lowest-fitness personas and ask DeepSeek to synthesize their exact realistic objections + generate 2 strategic ad variants in ONE call!
    worst3 = sorted(eval_res["per_person"], key=lambda x: x["fitness"])[:3]
    worst_profiles = [next(p for p in DEEP_PROFILES_10 if p["id"] == w["id"]) for w in worst3]
    worst_ctx = "\n".join(
        f"- {p['name']} ({p['age']} ساله، {p['job']}، {p['city']} | اعتماد={w['trust']:.0%}، کلیک={w['click']:.0%}، حس={w['reaction']}): {p['deep']}"
        for p, w in zip(worst_profiles, worst3)
    )
    heat_ctx = "\n".join(f"- [{sc:+.2f}] «{cl}»" for cl, sc in clause_scores)

    prompt = f"""تو یک استراتژیست ارشد تبلیغ‌نویسی ایرانی و پژوهشگر رفتار مصرف‌کننده هستی.
نتایج ارزیابی نسل فعلی تبلیغ در میان جمعیت ایرانی:
- نمره کل (Fitness): {eval_res['fitness']:.1f}/100
- توقف اسکرول: {eval_res['stop']:.0f}% | کلیک: {eval_res['click']:.0f}% | قصد اقدام: {eval_res['intent']:.0f}% | اعتماد: {eval_res['trust']:.0f}% | شفافیت: {eval_res['clarity']:.0f}%
- واکنش‌ها: {eval_res['reactions']}

تبلیغ فعلی:
{format_ad(champion_ad)}

هیت‌مپ جمله‌به‌جمله (از ۲- منفی تا ۲+ مثبت):
{heat_ctx}

۳ نفری که بیشترین ریزش و بی‌اعتمادی را داشتند:
{worst_ctx}

{PRODUCT_TRUTH}

وظیفه تو برای نسل {gen_num}:
۱) خلاصه ۳ اعتراض واقعی مردم را کوتاه بنویس.
۲) دقیقاً ۲ نسخه جدید و متمایز (variant_a و variant_b) برای بهبود ضعف‌های بالا بنویس:
   - variant_a: تمرکز بر رفع بی‌اعتمادی، شفافیت کامل قیمت/دوربین/اینماد و ریسک‌زدایی (۷ روز رایگان بدون کارت)
   - variant_b: تمرکز بر هوک فوق‌العاده قوی و طبیعی فارسی (بدون شعار کلیشه‌ای)، ملموس کردن درد واقعی (بی‌وقتی/ول کردن باشگاه) + شفافیت کامل
   - قوانین سختگیرانه: فقط از حقایق واقعی محصول استفاده کن، فارسی کاملاً طبیعی و روان، کوتاه و خواندنی برای اینستاگرام (تیتر زیر ۱۲ کلمه، متن ۲ تا ۳ جمله، CTA شفاف).

خروجی را دقیقاً با این ساختار JSON برگردان:
{{
  "diagnosis": "توضیح کوتاه ۱ جمله‌ای از دلیل افت تبلیغ فعلی",
  "objections": ["اعتراض ۱", "اعتراض ۲", "اعتراض ۳"],
  "variants": [
    {{"strategy": "رفع بی‌اعتمادی و شفافیت", "headline": "...", "body": "...", "cta": "..."}},
    {{"strategy": "هوک بومی + شفافیت ریسک‌زدا", "headline": "...", "body": "...", "cta": "..."}}
  ]
}}"""

    ds = call_deepseek(
        [{"role": "user", "content": prompt}],
        max_tokens=900,
        temperature=0.75,
        json_mode=True,
    )
    parsed = json.loads(ds["data"]["choices"][0]["message"]["content"])
    return parsed, clause_scores, r_heat["ms"], ds["ms"]


def test3_live_evolution_with_holdout():
    print("\n" + "=" * 78)
    print("  R3-3: LIVE DIAGNOSTIC-GUIDED EVOLUTION (g0 -> g1 -> g2 -> UNSEEN HOLDOUT)")
    print("=" * 78)

    # Evaluate g0 on train crowd (10 deep profiles) AND unseen holdout (6 deep profiles)
    g0_train = score_crowd_way_c(AD_G0, DEEP_PROFILES_10)
    g0_holdout = score_crowd_way_c(AD_G0, HOLDOUT_PROFILES_6)

    print(f"[g0 ORIGINAL] Train Fitness={g0_train['fitness']:.1f} (Stop={g0_train['stop']:.0f}% Click={g0_train['click']:.0f}% Intent={g0_train['intent']:.0f}% Trust={g0_train['trust']:.0f}% Clarity={g0_train['clarity']:.0f}%) | Rx={g0_train['reactions']}")
    print(f"              Holdout Fitness={g0_holdout['fitness']:.1f} (Trust={g0_holdout['trust']:.0f}% Click={g0_holdout['click']:.0f}%) | Rx={g0_holdout['reactions']}")

    champion = AD_G0
    champ_eval = g0_train
    history = [{"gen": 0, "ad": AD_G0, "train_fitness": g0_train["fitness"], "metrics": {k: g0_train[k] for k in ["stop", "click", "intent", "trust", "clarity", "reactions"]}}]

    for gen in [1, 2]:
        mut, heat, h_ms, d_ms = diagnose_and_mutate(champion, champ_eval, gen)
        print(f"\n--- Generation {gen} (Heatmap {h_ms}ms + DeepSeek Mutation {d_ms}ms) ---")
        print(f"  Diagnosis: {mut.get('diagnosis')}")
        print(f"  Clause Heatmap: " + " | ".join(f"[{sc:+.1f}] {cl[:28]}..." for cl, sc in heat))
        for vi, var in enumerate(mut["variants"]):
            ev = score_crowd_way_c(var, DEEP_PROFILES_10)
            is_best = ev["fitness"] > champ_eval["fitness"]
            print(f"  Var {vi+1} ({var['strategy']}): Fitness={ev['fitness']:.1f} ({ev['fitness']-champ_eval['fitness']:+.1f}) | Stop={ev['stop']:.0f}% Click={ev['click']:.0f}% Intent={ev['intent']:.0f}% Trust={ev['trust']:.0f}% Clarity={ev['clarity']:.0f}% | Rx={ev['reactions']} ({ev['ms']}ms)")
            print(f"     تیتر: {var['headline']}")
            print(f"     متن: {var['body']}")
            print(f"     CTA: {var['cta']}")
            if is_best:
                champion = var
                champ_eval = ev
        history.append({"gen": gen, "ad": champion, "train_fitness": champ_eval["fitness"], "metrics": {k: champ_eval[k] for k in ["stop", "click", "intent", "trust", "clarity", "reactions"]}})

    # Final Unseen Holdout Verification!
    champ_holdout = score_crowd_way_c(champion, HOLDOUT_PROFILES_6)
    print("\n" + "-" * 78)
    print("  UNSEEN HOLDOUT VERIFICATION (6 fresh Iranian profiles NEVER seen during g1-g2!)")
    print("-" * 78)
    print(f"  ORIGINAL (g0)  : Train={g0_train['fitness']:.1f}  |  UNSEEN HOLDOUT={g0_holdout['fitness']:.1f} (Trust={g0_holdout['trust']:.0f}%, Click={g0_holdout['click']:.0f}%, Intent={g0_holdout['intent']:.0f}%) | Rx={g0_holdout['reactions']}")
    print(f"  CHAMPION (g2)  : Train={champ_eval['fitness']:.1f}  |  UNSEEN HOLDOUT={champ_holdout['fitness']:.1f} (Trust={champ_holdout['trust']:.0f}%, Click={champ_holdout['click']:.0f}%, Intent={champ_holdout['intent']:.0f}%) | Rx={champ_holdout['reactions']}")
    print(f"  NET LIFT       : Train={champ_eval['fitness']-g0_train['fitness']:+.1f}  |  HOLDOUT={champ_holdout['fitness']-g0_holdout['fitness']:+.1f}")
    return {"history": history, "g0_holdout": g0_holdout, "champ_holdout": champ_holdout, "champion": champion}


def main():
    way_c, iso_map = test1_way_c_vs_isolated()
    depth = test2_shallow_vs_deep()
    evo = test3_live_evolution_with_holdout()
    out = RESULTS_DIR / "lab_round3_evolution.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"way_c": way_c, "depth": depth, "evolution": evo}, f, ensure_ascii=False, indent=2)
    print(f"\nSaved Round 3 results to {out}")


if __name__ == "__main__":
    main()
