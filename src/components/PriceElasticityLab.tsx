"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Loader2, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AudienceFilters, Persona, PriceElasticityResult, PriceOfferOption } from "@/lib/types";

interface PriceElasticityLabProps {
  allPersonas: Persona[];
}

interface PricePreset {
  id: string;
  label: string;
  productName: string;
  productDescription: string;
  basePriceToman: number;
  offers: PriceOfferOption[];
}

const PRICE_PRESETS: PricePreset[] = [
  {
    id: "kifyar_price",
    label: "اشتراک اپ مالی «کیف‌یار»",
    productName: "کیف‌یار — اپ مدیریت مالی شخصی و کاری",
    productDescription:
      "اپلیکیشن ایرانی دسته‌بندی خودکار پیامک‌های بانکی روی خود گوشی (آفلاین)، گزارش سود و زیان ماهانه و تفکیک حساب شخصی از کاری.",
    basePriceToman: 290_000,
    offers: [
      {
        id: "o1",
        label: "۹۹ هزار · ماهانه",
        priceToman: 99_000,
        offerHeadline: "حساب‌کتاب ماهانه‌ت با روزی ۳ هزار تومان",
        offerDetails: "اشتراک کامل ماهانه ۹۹ هزار تومان؛ هر وقت خواستی با یک کلیک لغو می‌کنی.",
        cta: "شروع با ۹۹ هزار تومان",
      },
      {
        id: "o2",
        label: "۱۴ روز رایگان + ۱۹۰ هزار",
        priceToman: 190_000,
        offerHeadline: "۱۴ روز رایگان امتحان کن، بعد ماهانه ۱۹۰ هزار تومان",
        offerDetails: "بدون نیاز به کارت بانکی برای تست؛ بعد از ۱۴ روز اگر راضی بودی ماهانه ۱۹۰ هزار تومان.",
        cta: "شروع تست رایگان",
      },
      {
        id: "o3",
        label: "۳۹۰ هزار · ماهانه",
        priceToman: 390_000,
        offerHeadline: "نسخه حرفه‌ای کیف‌یار، ماهانه ۳۹۰ هزار تومان",
        offerDetails: "تمامی امکانات تفکیک حساب شخصی و کاری و گزارش مالیاتی با اشتراک ماهانه ۳۹۰ هزار تومان.",
        cta: "خرید اشتراک ماهانه",
      },
      {
        id: "o4",
        label: "۱.۶ میلیون · سالانه قسطی",
        priceToman: 1_600_000,
        offerHeadline: "اشتراک یک‌ساله با ۴ قسط ۴۰۰ هزار تومانی بدون سود",
        offerDetails: "یک سال کامل بدون دغدغه تمدید؛ پرداخت در ۴ قسط مساوی بدون سود با اسنپ‌پی.",
        cta: "فعال‌سازی قسطی سالانه",
      },
    ],
  },
  {
    id: "noraplus_price",
    label: "سرم ویتامین C «نوراپلاس»",
    productName: "سرم ویتامین C ایرانی نوراپلاس (۳۰ میل)",
    productDescription:
      "سرم روشن‌کننده و ضدلک دارای سیب سلامت سازمان غذا و دارو، ارسال تیپاکس و ضمانت ۷ روزه بازگشت وجه.",
    basePriceToman: 490_000,
    offers: [
      {
        id: "n1",
        label: "۳۹۰ هزار · تک‌بطری",
        priceToman: 390_000,
        offerHeadline: "سرم ویتامین C نوراپلاس، فقط ۳۹۰ هزار تومان",
        offerDetails: "پرداخت آنلاین امن + ارسال به سراسر ایران (هزینه ارسال ۵۰ هزار تومان).",
        cta: "خرید آنلاین",
      },
      {
        id: "n2",
        label: "۴۹۰ هزار · ارسال رایگان + ضمانت",
        priceToman: 490_000,
        offerHeadline: "۴۹۰ هزار تومان، ارسال رایگان + ضمانت ۷ روزه بازگشت وجه",
        offerDetails: "پرداخت نقدی یا ۴ قسطه بدون سود اسنپ‌پی؛ اگر راضی نبودی تا ۷ روز پس می‌گیریم.",
        cta: "سفارش با ارسال رایگان",
      },
      {
        id: "n3",
        label: "۶۵۰ هزار · قسطی اسنپ‌پی",
        priceToman: 650_000,
        offerHeadline: "سرم ویتامین C با ۴ قسط ۱۶۲ هزار تومانی بدون سود",
        offerDetails: "همین امروز تحویل بگیر، قسط اول رو این ماه بده و بقیه رو طی ۳ ماه بدون کارمزد.",
        cta: "خرید ۴ قسطه",
      },
      {
        id: "n4",
        label: "۸۹۰ هزار · پک سرم + ضدآفتاب",
        priceToman: 890_000,
        offerHeadline: "پک کامل روتین روز (سرم + ضدآفتاب) ۸۹۰ هزار تومان",
        offerDetails: "۲۲۰ هزار تومان ارزان‌تر از خرید تکی + ارسال رایگان و پرداخت ۴ قسطه بدون سود.",
        cta: "خرید پک اقتصادی",
      },
    ],
  },
  {
    id: "maktab_price",
    label: "دوره هوش مصنوعی «مکتب‌خونه»",
    productName: "دوره عملی ChatGPT و ابزارهای هوش مصنوعی برای کار واقعی",
    productDescription:
      "آموزش فارسی اکسل، گزارش‌سازی، ایمیل و تولید محتوا با دسترسی همیشگی و گواهینامه مکتب‌خونه.",
    basePriceToman: 1_800_000,
    offers: [
      {
        id: "m1",
        label: "۹۸۰ هزار · نقدی",
        priceToman: 980_000,
        offerHeadline: "دوره کامل عملی هوش مصنوعی با ۹۸۰ هزار تومان",
        offerDetails: "دسترسی همیشگی به تمام ویدیوها و فایل‌های تمرین + پیش‌نمایش رایگان جلسه اول.",
        cta: "مشاهده جلسه اول",
      },
      {
        id: "m2",
        label: "۱.۸ میلیون · ۳ قسط بدون سود",
        priceToman: 1_800_000,
        offerHeadline: "دوره جامع + پروژه واقعی؛ ۳ قسط ۶۰۰ هزار تومانی بدون سود",
        offerDetails: "جلسه اول رایگان، دسترسی همیشگی، پشتیبانی رفع اشکال و گواهینامه پایان دوره.",
        cta: "ثبت‌نام قسطی",
      },
      {
        id: "m3",
        label: "۲.۹ میلیون · با منتورینگ اختصاصی",
        priceToman: 2_900_000,
        offerHeadline: "دوره عملی + ۴ جلسه منتورینگ روی فایل کار خودت (۲.۹ میلیون)",
        offerDetails: "پرداخت ۴ قسطه بدون سود؛ همراه با بررسی مستقیم فایل اکسل و گزارش‌های کاری خودت توسط مدرس.",
        cta: "رزرو دوره با منتور",
      },
      {
        id: "m4",
        label: "۳۹۰ هزار · اشتراک ماهانه کل دوره‌ها",
        priceToman: 390_000,
        offerHeadline: "با ماهانه ۳۹۰ هزار تومان به دوره AI و کل مکتب‌خونه دسترسی بگیر",
        offerDetails: "هر ماه تمدید یا لغو کن؛ بدون تعهد بلندمدت.",
        cta: "شروع اشتراک ماهانه",
      },
    ],
  },
];

function fmtTomanShort(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2).replace(/\.00$/, "")} م.ت`;
  if (val >= 1_000) return `${Math.round(val / 1_000).toLocaleString("fa-IR")} ه.ت`;
  return `${val.toLocaleString("fa-IR")} ت`;
}

export function PriceElasticityLab({ allPersonas }: PriceElasticityLabProps) {
  const [productName, setProductName] = useState(PRICE_PRESETS[0].productName);
  const [productDescription, setProductDescription] = useState(PRICE_PRESETS[0].productDescription);
  const [basePriceToman, setBasePriceToman] = useState(PRICE_PRESETS[0].basePriceToman);
  const [offers, setOffers] = useState<PriceOfferOption[]>(PRICE_PRESETS[0].offers);
  const [crowdSize, setCrowdSize] = useState<number>(60);
  const [filters, setFilters] = useState<AudienceFilters>({ gender: "all" });

  const [suggestLoading, setSuggestLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PriceElasticityResult | null>(null);

  const matchedCount = useMemo(() => {
    return allPersonas.filter((p) => {
      if (filters.cityTiers?.length && !filters.cityTiers.includes(p.city_tier)) return false;
      if (filters.incomeTiers?.length && !filters.incomeTiers.includes(p.income_tier)) return false;
      return true;
    }).length;
  }, [allPersonas, filters]);

  const updateOffer = (idx: number, patch: Partial<PriceOfferOption>) => {
    setOffers((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  const addOffer = () => {
    if (offers.length >= 6) return;
    setOffers((prev) => [
      ...prev,
      {
        id: `o_${Date.now().toString(36)}`,
        label: `پیشنهاد ${prev.length + 1}`,
        priceToman: basePriceToman,
        offerHeadline: "",
        offerDetails: "",
        cta: "شروع کنید",
      },
    ]);
  };

  const handleSuggestOffers = async () => {
    if (suggestLoading) return;
    setError(null);
    setSuggestLoading(true);
    try {
      const resp = await fetch("/api/price-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest",
          productName,
          productDescription,
          basePriceToman,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "خطا در تولید پیشنهادهای قیمتی");
      if (Array.isArray(data.offers) && data.offers.length >= 2) {
        setOffers(data.offers);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در پیشنهاد قیمت");
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleRunSweep = async () => {
    if (running) return;
    setError(null);
    setRunning(true);
    try {
      const resp = await fetch("/api/price-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate",
          productName,
          productDescription,
          offers,
          filters,
          crowdSize,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "خطا در اجرای آزمایش کشش قیمتی");
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در اجرای آزمایش");
    } finally {
      setRunning(false);
    }
  };

  // Dual Curve SVG geometry (Intent % vs Expected RPM)
  const maxRpm = result ? Math.max(1, ...result.offers.map((o) => o.expectedRpmToman)) : 1;
  const maxIntent = result ? Math.max(40, ...result.offers.map((o) => o.intentPct)) : 100;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            آزمایشگاه کشش قیمتی و فروش قسطی (تومان ۱۴۰۵)
          </h1>
          <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed">
            چند قیمت، تخفیف یا مدل قسطی (اسنپ‌پی / ازکی‌وام / اشتراک) را همزمان روی مردم ایران بسنجید و نقطه بیشترین درآمد (RPM) را پیدا کنید.
          </p>
        </div>
        <div className="text-xs text-zinc-400 tabular-nums shrink-0">
          <strong className="text-zinc-200">{matchedCount.toLocaleString("fa-IR")}</strong> مخاطب آماده تست
        </div>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {PRICE_PRESETS.map((pr) => {
          const active = productName === pr.productName;
          return (
            <button
              key={pr.id}
              type="button"
              onClick={() => {
                setProductName(pr.productName);
                setProductDescription(pr.productDescription);
                setBasePriceToman(pr.basePriceToman);
                setOffers(pr.offers);
                setResult(null);
              }}
              className={`text-right rounded-xl border px-4 py-3 transition-colors cursor-pointer ${
                active
                  ? "bg-white/[0.05] border-white/25 text-white"
                  : "bg-[#111113] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.15]"
              }`}
            >
              <div className="text-[11px] text-zinc-500 mb-0.5 tabular-nums">
                مرجع: {fmtTomanShort(pr.basePriceToman)}
              </div>
              <div className="text-xs font-semibold text-zinc-100">{pr.label}</div>
            </button>
          );
        })}
      </div>

      {/* Composer */}
      <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
        <div className="p-5 sm:p-6 space-y-4 border-b border-white/[0.06]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] text-zinc-500 mb-1.5">نام محصول یا سرویس</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1.5">قیمت پایه مرجع (تومان)</label>
              <input
                type="number"
                step={10000}
                value={basePriceToman}
                onChange={(e) => setBasePriceToman(Number(e.target.value) || 0)}
                className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-3.5 py-2 text-xs text-white tabular-nums focus:outline-none focus:border-white/30"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-zinc-500 mb-1.5">توضیح کوتاه محصول</label>
            <textarea
              rows={2}
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-3.5 py-2 text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        {/* Offer Rows */}
        <div className="p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-zinc-200">
              سناریوهای قیمت و پیشنهاد ({offers.length} گزینه)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSuggestOffers}
                disabled={suggestLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.12] bg-[#16161A] hover:bg-[#1E1E24] disabled:opacity-50 text-xs text-zinc-200 transition-colors cursor-pointer"
              >
                {suggestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" /> : <Sparkles className="w-3.5 h-3.5 text-sky-400" />}
                <span>پیشنهاد خودکار ۵ سناریو</span>
              </button>
              {offers.length < 6 && (
                <button
                  type="button"
                  onClick={addOffer}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            {offers.map((o, idx) => (
              <div
                key={o.id}
                className="rounded-lg border border-white/[0.06] bg-[#0B0B0D] p-3.5 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center"
              >
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={o.label}
                    onChange={(e) => updateOffer(idx, { label: e.target.value })}
                    placeholder="برچسب نمودار"
                    className="w-full bg-[#111113] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div className="md:col-span-2">
                  <input
                    type="number"
                    step={10000}
                    value={o.priceToman}
                    onChange={(e) => updateOffer(idx, { priceToman: Number(e.target.value) || 0 })}
                    placeholder="درآمد تومانی"
                    className="w-full bg-[#111113] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-emerald-300 tabular-nums focus:outline-none focus:border-white/30"
                    dir="ltr"
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    type="text"
                    value={o.offerHeadline}
                    onChange={(e) => updateOffer(idx, { offerHeadline: e.target.value })}
                    placeholder="تیتر پیشنهاد..."
                    className="w-full bg-[#111113] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div className="md:col-span-4">
                  <input
                    type="text"
                    value={o.offerDetails}
                    onChange={(e) => updateOffer(idx, { offerDetails: e.target.value })}
                    placeholder="شرایط پرداخت، قسط یا ضمانت..."
                    className="w-full bg-[#111113] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div className="md:col-span-1 flex justify-end">
                  {offers.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOffers((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                      aria-label="حذف گزینه"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="border-t border-white/[0.06] bg-[#0E0E10] px-5 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <label className="text-zinc-500">جمعیت تست:</label>
            <select
              value={crowdSize}
              onChange={(e) => setCrowdSize(Number(e.target.value))}
              className="bg-[#09090B] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-100 tabular-nums"
            >
              <option value={45}>۴۵ نفر — سریع</option>
              <option value={60}>۶۰ نفر — متعادل</option>
              <option value={90}>۹۰ نفر — دقیق</option>
              <option value={150}>۱۵۰ نفر — گسترده</option>
            </select>

            <span className="text-zinc-700">·</span>

            {(["تهران", "کلان‌شهر"] as const).map((ct) => {
              const on = filters.cityTiers?.includes(ct);
              return (
                <button
                  key={ct}
                  type="button"
                  onClick={() =>
                    setFilters((prev) => {
                      const cur = prev.cityTiers ?? [];
                      const next = cur.includes(ct) ? cur.filter((x) => x !== ct) : [...cur, ct];
                      return { ...prev, cityTiers: next.length ? next : undefined };
                    })
                  }
                  className={`px-2.5 py-1 rounded-md border text-[11px] transition-colors cursor-pointer ${
                    on
                      ? "bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold"
                      : "border-white/[0.08] text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {ct}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleRunSweep}
            disabled={running}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{running ? "در حال سنجش کشش قیمتی..." : "اجرای منحنی کشش قیمتی"}</span>
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/[0.08] border border-red-500/25 rounded-lg p-3.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Dashboard */}
      {result && (
        <div className="space-y-5">
          {/* Strategic Takeaway */}
          <div className="rounded-xl border border-white/[0.08] border-r-2 border-r-emerald-400 bg-[#111113] p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-emerald-400">
                جمع‌بندی استراتژیک کشش قیمتی ({result.crowdCount} مخاطب · {(result.durationMs / 1000).toFixed(1)} ثانیه)
              </div>
              <p className="text-[13px] text-zinc-100 leading-[1.8]">{result.insightSummary}</p>
            </div>
            <span className="text-xs font-mono text-zinc-400 shrink-0" dir="ltr">
              ${result.totalCostUsd.toFixed(4)}
            </span>
          </div>

          {/* Dual Bar / Curve Visualization: Demand % vs Expected RPM */}
          <section className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-[13px] font-semibold text-zinc-100">
                منحنی تقاضا در برابر درآمد مورد انتظار (RPM به ازای هر ۱٬۰۰۰ نمایش)
              </h3>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-sky-300">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  تمایل خرید (٪)
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  درآمد هر ۱٬۰۰۰ نمایش (RPM)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {result.offers.map((ev) => {
                const isBestRev = ev.offer.id === result.bestRevenueId;
                const isBestConv = ev.offer.id === result.bestConversionId;
                const intentW = Math.min(100, Math.max(5, (ev.intentPct / maxIntent) * 100));
                const rpmW = Math.min(100, Math.max(5, (ev.expectedRpmToman / maxRpm) * 100));
                return (
                  <div
                    key={ev.offer.id}
                    className={`rounded-xl border p-4 space-y-3 ${
                      isBestRev
                        ? "border-emerald-500/45 bg-emerald-500/[0.04]"
                        : "border-white/[0.07] bg-[#0B0B0D]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">{ev.offer.label}</div>
                        <div className="text-[11px] text-zinc-500 tabular-nums mt-0.5">
                          قیمت: {fmtTomanShort(ev.offer.priceToman)}
                        </div>
                      </div>
                      {isBestRev ? (
                        <span className="text-[10.5px] font-semibold text-emerald-400">بیشترین درآمد</span>
                      ) : isBestConv ? (
                        <span className="text-[10.5px] font-semibold text-sky-400">بیشترین جذب</span>
                      ) : null}
                    </div>

                    <div className="space-y-2 tabular-nums">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-zinc-400">تمایل خرید</span>
                          <span className="text-sky-300 font-semibold">{ev.intentPct}٪</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-sky-400" style={{ width: `${intentW}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-zinc-400">درآمد ۱٬۰۰۰ نمایش</span>
                          <span className="text-emerald-300 font-semibold">{fmtTomanShort(ev.expectedRpmToman)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${rpmW}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-1.5 flex-wrap text-[11px] text-zinc-500 tabular-nums">
                      {typeof ev.preferenceSharePct === "number" && (
                        <span className="text-sky-300">سهم انتخاب {Math.round(ev.preferenceSharePct)}٪</span>
                      )}
                      <span>کلیک {Math.round(ev.clickPct)}٪</span>
                      <span className={ev.priceShockPct > 55 ? "text-red-400" : "text-zinc-400"}>
                        شوک قیمتی {Math.round(ev.priceShockPct)}٪
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Income-Tier Sensitivity Matrix */}
          <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-white/[0.06]">
              <h3 className="text-[13px] font-semibold text-zinc-100">
                حساسیت قیمتی به تفکیک طبقه درآمدی ایران (تمایل خرید ٪)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-[#0D0D0F] text-zinc-500 text-[11px]">
                    <th className="px-5 py-3 font-medium">طبقه درآمدی</th>
                    {result.offers.map((ev) => (
                      <th key={ev.offer.id} className="px-4 py-3 font-medium">
                        {ev.offer.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] tabular-nums">
                  {(result.offers[0]?.byIncome ?? []).map((tierRow) => (
                    <tr key={tierRow.tier} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-medium text-zinc-200">
                        {tierRow.tier}{" "}
                        <span className="text-zinc-500 text-[11px]">({tierRow.count})</span>
                      </td>
                      {result.offers.map((ev) => {
                        const cell = ev.byIncome.find((x) => x.tier === tierRow.tier);
                        const val = cell?.intentPct ?? 0;
                        const shock = cell?.priceShockPct ?? 0;
                        return (
                          <td key={ev.offer.id} className="px-4 py-3">
                            <span
                              className={`font-semibold ${
                                val >= 55 ? "text-emerald-400" : val >= 30 ? "text-zinc-200" : "text-zinc-500"
                              }`}
                            >
                              {val.toFixed(0)}٪
                            </span>
                            <span className="text-[10.5px] text-zinc-600 mr-1.5">
                              (شوک {Math.round(shock)}٪)
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
