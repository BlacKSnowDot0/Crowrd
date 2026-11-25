"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Search, X } from "lucide-react";
import type { Persona } from "@/lib/types";

interface CrowdExplorerProps {
  personas: Persona[];
  onCrowdUpdated: () => void;
  onInterviewPersona: (personaId: string) => void;
}

export function CrowdExplorer({ personas, onCrowdUpdated, onInterviewPersona }: CrowdExplorerProps) {
  const [query, setQuery] = useState("");
  const [cityTier, setCityTier] = useState<string>("all");
  const [incomeTier, setIncomeTier] = useState<string>("all");
  const [archetype, setArchetype] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(24);

  const [showGenModal, setShowGenModal] = useState(false);
  const [nicheDesc, setNicheDesc] = useState("");
  const [nicheTag, setNicheTag] = useState("");
  const [genCount, setGenCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);

  const archetypes = useMemo(
    () => Array.from(new Set(personas.map((p) => p.ad_archetype))).sort(),
    [personas]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return personas.filter((p) => {
      if (cityTier !== "all" && p.city_tier !== cityTier) return false;
      if (incomeTier !== "all" && p.income_tier !== incomeTier) return false;
      if (archetype !== "all" && p.ad_archetype !== archetype) return false;
      if (q) {
        const hay = `${p.name} ${p.city} ${p.neighborhood} ${p.province} ${p.job} ${p.sector} ${p.ad_archetype} ${p.life_story} ${p.custom_tag ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [personas, query, cityTier, incomeTier, archetype]);

  const stats = useMemo(() => {
    const cities = new Set(personas.map((p) => p.city)).size;
    const avgAge = personas.length ? Math.round(personas.reduce((s, p) => s + p.age, 0) / personas.length) : 0;
    const avgSkep = personas.length
      ? (personas.reduce((s, p) => s + p.ad_skepticism, 0) / personas.length).toFixed(1)
      : "0";
    return { cities, avgAge, avgSkep };
  }, [personas]);

  const handleGenerate = async () => {
    if (!nicheDesc.trim()) return;
    setGenerating(true);
    setGenError(null);
    setGenSuccess(null);
    try {
      const resp = await fetch("/api/crowd/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicheDescription: nicheDesc.trim(),
          tag: nicheTag.trim() || nicheDesc.trim().slice(0, 24),
          count: genCount,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "خطا در ساخت پرسوناها");
      setGenSuccess(`${data.added} پروفایل جدید ساخته و به بانک اضافه شد (مجموع: ${data.total} نفر).`);
      setNicheDesc("");
      setNicheTag("");
      onCrowdUpdated();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "خطا");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">بانک جمعیت ایران</h1>
          <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed">
            پروفایل‌های شبیه‌سازی‌شده با جزئیات محله، درآمد ماهانه، عادت پرداخت، سطح بدبینی و سابقه خرید آنلاین.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowGenModal(true);
            setGenError(null);
            setGenSuccess(null);
          }}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>ساخت گروه مخاطب جدید</span>
        </button>
      </div>

      {/* Unified Demographic Stat Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#111113]">
        <StatCell label="کل پروفایل‌ها" value={personas.length.toLocaleString("fa-IR")} />
        <StatCell label="تنوع شهرها" value={`${stats.cities.toLocaleString("fa-IR")} شهر`} />
        <StatCell label="میانگین سن" value={`${stats.avgAge} سال`} />
        <StatCell label="میانگین بدبینی به تبلیغ" value={`${stats.avgSkep} از ۵`} />
      </div>

      {/* Clean Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleCount(24);
            }}
            placeholder="جستجو در نام، شهر، محله، شغل یا شرح زندگی..."
            className="w-full bg-[#111113] border border-white/[0.08] rounded-lg pr-9 pl-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>

        <select
          value={cityTier}
          onChange={(e) => {
            setCityTier(e.target.value);
            setVisibleCount(24);
          }}
          className="bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-white/30 min-w-[132px]"
        >
          <option value="all">همه شهرها</option>
          <option value="تهران">تهران</option>
          <option value="کلان‌شهر">کلان‌شهرها</option>
          <option value="مرکز استان">مراکز استان</option>
          <option value="شهرستان">شهرستان‌ها</option>
        </select>

        <select
          value={incomeTier}
          onChange={(e) => {
            setIncomeTier(e.target.value);
            setVisibleCount(24);
          }}
          className="bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-white/30 min-w-[148px]"
        >
          <option value="all">همه سطوح درآمد</option>
          <option value="کم‌درآمد">کم‌درآمد</option>
          <option value="متوسط رو به پایین">متوسط رو به پایین</option>
          <option value="متوسط">متوسط</option>
          <option value="متوسط رو به بالا">متوسط رو به بالا</option>
          <option value="مرفه">مرفه</option>
        </select>

        <select
          value={archetype}
          onChange={(e) => {
            setArchetype(e.target.value);
            setVisibleCount(24);
          }}
          className="bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-white/30 min-w-[156px]"
        >
          <option value="all">همه تیپ‌های مخاطب</option>
          {archetypes.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <span className="text-xs text-zinc-500 tabular-nums mr-auto">
          {Math.min(visibleCount, filtered.length).toLocaleString("fa-IR")} از{" "}
          {filtered.length.toLocaleString("fa-IR")}
        </span>
      </div>

      {/* Editorial Persona Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.slice(0, visibleCount).map((p) => (
          <article
            key={p.id}
            className="rounded-xl border border-white/[0.08] bg-[#111113] hover:border-white/[0.16] transition-colors p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-3.5">
              {/* Identity header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-100 font-semibold text-sm shrink-0 border border-white/[0.08]"
                    style={{ backgroundColor: `hsl(${p.avatar_hue}, 18%, 18%)` }}
                  >
                    {p.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="text-sm font-semibold text-white truncate">{p.name}</h3>
                      <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">{p.age}س</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {p.neighborhood}، {p.city}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-zinc-300 font-medium tabular-nums shrink-0">
                  {p.monthly_income_m}م ت
                </span>
              </div>

              {/* Clean single metadata line — no pill soup */}
              <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-relaxed">
                <span className="text-zinc-200">{p.job}</span>
                <span className="text-zinc-700">·</span>
                <span>{p.ad_archetype}</span>
                <span className="text-zinc-700">·</span>
                <span className="tabular-nums">بدبینی {p.ad_skepticism}/۵</span>
                {p.custom_tag && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="text-sky-400">{p.custom_tag}</span>
                  </>
                )}
              </div>

              {/* Bio */}
              <p className="text-[12.5px] text-zinc-300 leading-[1.8] line-clamp-4">{p.life_story}</p>

              {/* Hairline blockquote */}
              <div className="text-[11.5px] text-zinc-400 border-r-2 border-white/15 pr-2.5 leading-[1.7] line-clamp-2">
                «{p.voice_sample}»
              </div>

              {/* Quiet semantic trigger/red-flag summary */}
              <div className="space-y-1 text-[11px] text-zinc-400 pt-0.5">
                {p.triggers.length > 0 && (
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{p.triggers.slice(0, 2).join(" · ")}</span>
                  </div>
                )}
                {p.red_flags.length > 0 && (
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="truncate">{p.red_flags.slice(0, 2).join(" · ")}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onInterviewPersona(p.id)}
              className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <span>پرونده کامل و مصاحبه زنده</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </article>
        ))}
      </div>

      {visibleCount < filtered.length && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + 24)}
            className="px-5 py-2 rounded-lg border border-white/[0.1] bg-[#111113] hover:bg-[#18181B] text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
          >
            نمایش ۲۴ نفر بیشتر ({(filtered.length - visibleCount).toLocaleString("fa-IR")} نفر باقی‌مانده)
          </button>
        </div>
      )}

      {/* Custom Niche Generator Modal */}
      {showGenModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => !generating && setShowGenModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-white/[0.1] bg-[#111113] p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-white">ساخت گروه مخاطب اختصاصی</h3>
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                aria-label="بستن"
                className="p-1 rounded-md text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 leading-[1.75]">
              مخاطب هدف خود را توصیف کنید تا پروفایل‌های واقعی و متنوعی برای آن ساخته و به بانک جمعیت اضافه شود.
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1.5">برچسب گروه (برای فیلتر سریع)</label>
                <input
                  type="text"
                  value={nicheTag}
                  onChange={(e) => setNicheTag(e.target.value)}
                  placeholder="مثلاً: مدیران کلینیک زیبایی"
                  className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1.5">توضیح مخاطب هدف</label>
                <textarea
                  rows={3}
                  value={nicheDesc}
                  onChange={(e) => setNicheDesc(e.target.value)}
                  placeholder="مثلاً: مادران دارای نوزاد زیر ۲ سال در تهران، مشهد و اصفهان با درآمد متوسط به بالا که خرید آنلاین دارند..."
                  className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white leading-[1.75] placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1.5">تعداد پروفایل جدید</label>
                <select
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-white/30"
                >
                  <option value={6}>۶ پروفایل جدید (~۱۰ ثانیه)</option>
                  <option value={10}>۱۰ پروفایل جدید (~۱۵ ثانیه)</option>
                  <option value={16}>۱۶ پروفایل جدید (~۲۲ ثانیه)</option>
                </select>
              </div>
            </div>

            {genError && (
              <div className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/25 rounded-lg p-3">
                {genError}
              </div>
            )}
            {genSuccess && (
              <div className="text-xs text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/25 rounded-lg p-3">
                {genSuccess}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                disabled={generating}
                onClick={() => setShowGenModal(false)}
                className="px-4 py-2 rounded-lg border border-white/[0.08] text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                بستن
              </button>
              <button
                type="button"
                disabled={generating || nicheDesc.trim().length < 6}
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-40 text-xs font-semibold text-zinc-950 transition-colors cursor-pointer"
              >
                {generating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{generating ? "در حال ساخت..." : "ساخت و افزودن"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xl font-bold text-white tabular-nums leading-none">{value}</div>
      <div className="text-[11px] text-zinc-500 mt-1.5">{label}</div>
    </div>
  );
}
