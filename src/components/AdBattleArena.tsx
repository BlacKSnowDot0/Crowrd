"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Loader2, Plus, Swords, Trash2, Trophy } from "lucide-react";
import type { AdCopy, AudienceFilters, BattleContenderInput, BattleResult, Persona } from "@/lib/types";

interface AdBattleArenaProps {
  allPersonas: Persona[];
}

const BATTLE_PRESETS: Array<{
  label: string;
  platform: NonNullable<AdCopy["platform"]>;
  filters: AudienceFilters;
  contenders: BattleContenderInput[];
}> = [
  {
    label: "استوری ضدآفتاب پوست چرب (۳ فریم در برابر بروشور)",
    platform: "instagram_story",
    filters: { cityTiers: ["تهران", "کلان‌شهر"], minAge: 20, maxAge: 42 },
    contenders: [
      {
        id: "ad_1",
        label: "استوری ۳ فریمی بومی",
        ad: {
          headline: "ضدآفتاب بی‌رنگ که پوست چربت رو برق نمی‌اندازه",
          body: "بافت فلوئیدی SPF50 بدون رد سفیدی و جوش. ۷ روز ضمانت اصالت و ارسال رایگان.",
          cta: "دیدن نظرات واقعی",
          platform: "instagram_story",
        },
      },
      {
        id: "ad_2",
        label: "متن بروشوری کلیشه‌ای",
        ad: {
          headline: "زیبایی و درخشش بی‌نظیر پوست با محصول مراقبتی جدید ما",
          body: "با فرمولاسیون پیشرفته و مدرن ما طراوت و جوانی را به پوست خود هدیه دهید و هر روز زیباتر و شاداب‌تر بدرخشید.",
          cta: "خرید محصول",
          platform: "instagram_story",
        },
      },
      {
        id: "ad_3",
        label: "آفر تخفیفی مستقیم",
        ad: {
          headline: "۲۰٪ تخفیف ضدآفتاب پوست چرب فقط تا آخر هفته",
          body: "ارسال رایگان به سراسر ایران با امکان پرداخت قسطی ۴ مرحله‌ای اسنپ‌پی.",
          cta: "ثبت سفارش با تخفیف",
          platform: "instagram_story",
        },
      },
    ],
  },
  {
    label: "ریلز دوره ChatGPT (قلاب ۰-۳ ثانیه در برابر معرفی رسمی)",
    platform: "instagram_reels",
    filters: { cityTiers: ["تهران", "کلان‌شهر"], minAge: 20, maxAge: 46 },
    contenders: [
      {
        id: "ad_1",
        label: "قلاب ۰-۳ ثانیه + کامنت دایرکت",
        ad: {
          headline: "اگه هنوز گزارش اکسلت ۲ ساعت وقت می‌بره، اینو اسکرول نکن!",
          body: "نمایش مستقیم لپ‌تاپ: ساخت گزارش اکسل و ایمیل کاری با ChatGPT در ۳۰ ثانیه + تمرین عملی روی فایل واقعی در مکتب‌خونه.",
          cta: "کلمه «اکسل» رو کامنت کن لینک جلسه اول رایگان بیاد دایرکتت",
          platform: "instagram_reels",
        },
      },
      {
        id: "ad_2",
        label: "ریلز معرفی رسمی + لینک بیو",
        ad: {
          headline: "سلام به همگی، امروز دوره جامع هوش مصنوعی مکتب‌خونه رو معرفی می‌کنیم",
          body: "در این دوره بیش از ۵۰ ابزار هوش مصنوعی و مهندسی پرامپت را یاد می‌گیرید و بهره‌وری خود را چند برابر می‌کنید.",
          cta: "برای ثبت‌نام به لینک بیو مراجعه کنید",
          platform: "instagram_reels",
        },
      },
    ],
  },
  {
    label: "تلگرام حسابداری مغازه (درد واقعی در برابر تیتر معمایی)",
    platform: "telegram",
    filters: { minAge: 25, maxAge: 55 },
    contenders: [
      {
        id: "ad_1",
        label: "درد مغازه‌دار + تست ۱۴ روزه",
        ad: {
          headline: "شب‌ها هنوز چک‌های مغازه رو توی دفترچه حساب می‌کنی؟",
          body: "نرم‌افزار حسابداری هلو روی گوشی: ثبت فاکتور، یادآور سررسید چک صیادی و سود روزانه مغازه در ۲ دقیقه. ۱۴ روز تست رایگان.",
          cta: "شروع تست ۱۴ روزه",
          platform: "telegram",
        },
      },
      {
        id: "ad_2",
        label: "تیتر شاعرانه و معمایی",
        ad: {
          headline: "ساعت ۱۱ شب، یک خودکار آبی و سه فنجان چای سرد",
          body: "بعضی عادت‌ها فقط وقتت را می‌خورند و آخر ماه هنوز نمی‌دانی چقدر برایت مانده. وقتش رسیده جور دیگری ببینی.",
          cta: "شروع کن",
          platform: "telegram",
        },
      },
      {
        id: "ad_3",
        label: "فهرست امکانات خشک",
        ad: {
          headline: "نرم‌افزار جامع حسابداری و انبارداری تحت وب و موبایل",
          body: "ارائه کامل‌ترین امکانات صدور فاکتور، گزارش سود و زیان، مدیریت چک و اتصال به سامانه مودیان با پشتیبانی تخصصی.",
          cta: "مشاهده پلن‌ها",
          platform: "telegram",
        },
      },
    ],
  },
];

const PLATFORM_OPTIONS: Array<{
  key: NonNullable<AdCopy["platform"]>;
  label: string;
  hLabel: string;
  bLabel: string;
  cLabel: string;
}> = [
  { key: "instagram_story", label: "استوری اینستاگرام", hLabel: "فریم ۱ (قلاب روی تصویر)", bLabel: "فریم ۲ (اثبات کوتاه)", cLabel: "فریم ۳ (استیکر لینک)" },
  { key: "instagram_reels", label: "ریلز اینستاگرام", hLabel: "قلاب ۰ تا ۳ ثانیه", bLabel: "سناریوی ۱۵ ثانیه‌ای ویدیو", cLabel: "محرک کامنت/دایرکت یا CTA" },
  { key: "telegram", label: "تلگرام", hLabel: "تیتر پست تلگرام", bLabel: "متن تبلیغ", cLabel: "دکمه شیشه‌ای / لینک" },
  { key: "banner", label: "همسان یکتانت", hLabel: "تیتر (حداکثر ۴۸ کاراکتر)", bLabel: "زیرتیتر کوتاه", cLabel: "دکمه اقدام" },
  { key: "divar", label: "دیوار", hLabel: "عنوان آگهی دیوار", bLabel: "توضیح واقعی آگهی", cLabel: "اقدام" },
];

export function AdBattleArena({ allPersonas }: AdBattleArenaProps) {
  const [platform, setPlatform] = useState<NonNullable<AdCopy["platform"]>>(BATTLE_PRESETS[0].platform);
  const [contenders, setContenders] = useState<BattleContenderInput[]>(BATTLE_PRESETS[0].contenders);
  const [filters, setFilters] = useState<AudienceFilters>(BATTLE_PRESETS[0].filters);
  const [crowdSize, setCrowdSize] = useState<number>(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);

  const platMeta = PLATFORM_OPTIONS.find((p) => p.key === platform) ?? PLATFORM_OPTIONS[0];

  const matchedCount = useMemo(() => {
    return allPersonas.filter((p) => {
      if (filters.cityTiers?.length && !filters.cityTiers.includes(p.city_tier)) return false;
      if (filters.incomeTiers?.length && !filters.incomeTiers.includes(p.income_tier)) return false;
      if (filters.minAge && p.age < filters.minAge) return false;
      if (filters.maxAge && p.age > filters.maxAge) return false;
      return true;
    }).length;
  }, [allPersonas, filters]);

  const applyPreset = (idx: number) => {
    const p = BATTLE_PRESETS[idx];
    setPlatform(p.platform);
    setContenders(p.contenders.map((c) => ({ ...c, ad: { ...c.ad } })));
    setFilters({ ...p.filters });
    setResult(null);
    setError(null);
  };

  const addContender = () => {
    if (contenders.length >= 4) return;
    const n = contenders.length + 1;
    setContenders((prev) => [
      ...prev,
      {
        id: `ad_${Date.now().toString(36)}`,
        label: `نسخه ${n}`,
        ad: { headline: "", body: "", cta: "مشاهده", platform },
      },
    ]);
  };

  const removeContender = (id: string) => {
    if (contenders.length <= 2) return;
    setContenders((prev) => prev.filter((c) => c.id !== id));
  };

  const updateContender = (id: string, patch: Partial<BattleContenderInput> & { adPatch?: Partial<AdCopy> }) => {
    setContenders((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              ...(patch.label !== undefined ? { label: patch.label } : {}),
              ad: patch.adPatch ? { ...c.ad, ...patch.adPatch } : c.ad,
            }
          : c
      )
    );
  };

  const toggleCity = (tier: string) => {
    setFilters((prev) => {
      const cur = prev.cityTiers ?? [];
      const next = cur.includes(tier) ? cur.filter((x) => x !== tier) : [...cur, tier];
      return { ...prev, cityTiers: next.length ? next : undefined };
    });
  };

  const runBattle = async () => {
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          contenders,
          filters,
          crowdSize,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "خطا در اجرای نبرد سریع");
      }
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در اجرای نبرد سریع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-sky-400" />
            <h1 className="text-lg font-bold text-white">نبرد سریع ۱۰ ثانیه‌ای A/B/C</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            ۲ تا ۴ تبلیغ (پیش‌نویس‌های خودتان یا تبلیغ شما در برابر رقیب) را همزمان جلوی جمعیت واقعی ایرانی بگذارید و بدون صبر ۳ دقیقه‌ای، برنده و گلوگاه قیف هر نسخه را ببینید.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {BATTLE_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(idx)}
              className="text-[11px] px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-[#111113] text-zinc-300 hover:text-white hover:border-white/25 transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-zinc-500 ml-1">فرمت نمایش:</span>
            {PLATFORM_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPlatform(opt.key)}
                className={`px-2.5 py-1 rounded-lg text-[11.5px] transition-colors cursor-pointer ${
                  platform === opt.key
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-medium"
                    : "bg-[#09090B] text-zinc-400 border border-white/[0.06] hover:text-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-1">
              {(["تهران", "کلان‌شهر", "مرکز استان", "شهرستان"] as const).map((tier) => {
                const on = filters.cityTiers?.includes(tier);
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => toggleCity(tier)}
                    className={`px-2 py-1 rounded-md text-[11px] border transition-colors cursor-pointer ${
                      on
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-white/[0.06] bg-[#09090B] text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {tier}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 tabular-nums">
              <span>جمعیت:</span>
              {[36, 60, 96].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setCrowdSize(sz)}
                  className={`px-2 py-0.5 rounded border cursor-pointer ${
                    crowdSize === sz
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/[0.06] text-zinc-500"
                  }`}
                >
                  {sz}
                </button>
              ))}
              <span className="text-zinc-500">({matchedCount} نفر مطابق)</span>
            </div>
          </div>
        </div>

        {/* Contenders Grid */}
        <div className={`grid grid-cols-1 ${contenders.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-3.5`}>
          {contenders.map((c, idx) => (
            <div key={c.id} className="rounded-xl border border-white/[0.08] bg-[#0B0B0D] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={c.label}
                  onChange={(e) => updateContender(c.id, { label: e.target.value })}
                  className="bg-transparent text-xs font-bold text-white focus:outline-none border-b border-transparent focus:border-white/25 pb-0.5 w-full"
                  placeholder={`نام نسخه ${idx + 1}`}
                />
                {contenders.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeContender(c.id)}
                    className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer shrink-0"
                    aria-label="حذف نسخه"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[10.5px] text-zinc-500 mb-1">{platMeta.hLabel}</label>
                <input
                  type="text"
                  value={c.ad.headline}
                  onChange={(e) => updateContender(c.id, { adPatch: { headline: e.target.value } })}
                  className="w-full bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/25"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-zinc-500 mb-1">{platMeta.bLabel}</label>
                <textarea
                  rows={3}
                  value={c.ad.body}
                  onChange={(e) => updateContender(c.id, { adPatch: { body: e.target.value } })}
                  className="w-full bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-white/25"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-zinc-500 mb-1">{platMeta.cLabel}</label>
                <input
                  type="text"
                  value={c.ad.cta}
                  onChange={(e) => updateContender(c.id, { adPatch: { cta: e.target.value } })}
                  className="w-full bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/25"
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3.5 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          {contenders.length < 4 ? (
            <button
              type="button"
              onClick={addContender}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-2 rounded-lg border border-white/[0.08] hover:border-white/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن رقیب ({contenders.length}/4)</span>
            </button>
          ) : (
            <span className="text-[11px] text-zinc-500">حداکثر ۴ نسخه همزمان</span>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={runBattle}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
            <span>{loading ? "در حال داوری جمعیت واقعی..." : `شروع نبرد روی ${Math.min(crowdSize, matchedCount)} ایرانی`}</span>
          </button>
        </div>
      </div>

      {/* Results Dashboard */}
      {result && (
        <div className="space-y-5">
          {/* Executive Verdict */}
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5 flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Trophy className="w-4 h-4" />
                <span>نتیجه نهایی نبرد ({result.crowdCount} مخاطب ایرانی · بدون سوگیری ترتیب)</span>
              </div>
              <p className="text-sm text-zinc-100 leading-relaxed">{result.verdictSummary}</p>
            </div>
            <div className="text-[11px] text-zinc-400 tabular-nums shrink-0" dir="ltr">
              {(result.durationMs / 1000).toFixed(1)}s · ${result.totalCostUsd} · None {result.nonePct}%
            </div>
          </section>

          {/* Contender Scorecards */}
          <div className={`grid grid-cols-1 ${result.contenders.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4`}>
            {result.contenders.map((c) => {
              const isWin = c.id === result.winnerId;
              return (
                <article
                  key={c.id}
                  className={`rounded-xl border p-5 space-y-4 ${
                    isWin ? "border-emerald-500/45 bg-emerald-500/[0.03]" : "border-white/[0.08] bg-[#111113]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{c.label}</span>
                    {isWin && (
                      <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        برنده میدان
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 tabular-nums">
                    <div className="rounded-lg bg-[#09090B] border border-white/[0.06] p-2.5">
                      <div className="text-[10px] text-zinc-500">سهم تورنمنت</div>
                      <div className="text-base font-bold text-emerald-300 mt-0.5">{c.tournamentSharePct}٪</div>
                    </div>
                    <div className="rounded-lg bg-[#09090B] border border-white/[0.06] p-2.5">
                      <div className="text-[10px] text-zinc-500">امتیاز قیف</div>
                      <div className="text-base font-bold text-white mt-0.5">
                        {c.fitness}
                        <span className="text-[10px] text-zinc-500 font-normal"> ±{c.fitnessStd}</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#09090B] border border-white/[0.06] p-2.5">
                      <div className="text-[10px] text-zinc-500">CTR تخمینی</div>
                      <div className="text-base font-bold text-sky-300 mt-0.5">~{c.estCtrPct}٪</div>
                    </div>
                  </div>

                  <div className="text-[11.5px] text-zinc-300 bg-[#09090B] border border-white/[0.06] rounded-lg p-3 space-y-1">
                    <div className="font-semibold text-white">{c.ad.headline}</div>
                    <div className="text-zinc-400 leading-relaxed">{c.ad.body}</div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] tabular-nums">
                    <div className="rounded bg-white/[0.03] py-1.5">
                      <div className="text-[10px] text-zinc-500">تناسب</div>
                      <div className="font-semibold text-zinc-200">{Math.round(c.relevance)}٪</div>
                    </div>
                    <div className="rounded bg-white/[0.03] py-1.5">
                      <div className="text-[10px] text-zinc-500">توقف</div>
                      <div className="font-semibold text-zinc-200">{Math.round(c.stop)}٪</div>
                    </div>
                    <div className="rounded bg-white/[0.03] py-1.5">
                      <div className="text-[10px] text-zinc-500">شفافیت</div>
                      <div className="font-semibold text-zinc-200">{Math.round(c.clarity)}٪</div>
                    </div>
                    <div className="rounded bg-white/[0.03] py-1.5">
                      <div className="text-[10px] text-zinc-500">اعتماد</div>
                      <div className="font-semibold text-zinc-200">{Math.round(c.trust)}٪</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-zinc-400 border-t border-white/[0.06] pt-2.5 leading-relaxed">
                    <strong className="text-zinc-200">تشخیص: </strong>
                    {c.bottleneck}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Buyer Archetype Matrix */}
          {result.archetypeMatrix.length > 0 && (
            <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.06]">
                <h3 className="text-[13px] font-semibold text-zinc-100">
                  ماتریس رأی تیپ‌های خریدار ایرانی (کدام تیپ کدام تبلیغ را انتخاب کرد؟)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] text-zinc-500">
                      <th className="py-2.5 px-4 font-medium">تیپ خریدار</th>
                      <th className="py-2.5 px-3 font-medium">تعداد</th>
                      {result.contenders.map((c) => (
                        <th key={c.id} className="py-2.5 px-3 font-medium">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] tabular-nums">
                    {result.archetypeMatrix.map((row) => (
                      <tr key={row.archetype} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-4 text-zinc-200 font-medium">{row.archetype}</td>
                        <td className="py-2.5 px-3 text-zinc-500">{row.count}</td>
                        {result.contenders.map((c) => {
                          const pct = row.shares[c.id] ?? 0;
                          const isRowWin = row.winnerId === c.id;
                          return (
                            <td
                              key={c.id}
                              className={`py-2.5 px-3 ${
                                isRowWin ? "text-emerald-300 font-bold" : "text-zinc-400"
                              }`}
                            >
                              {pct}٪
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
