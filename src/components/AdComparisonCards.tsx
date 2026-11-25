"use client";

import { useState } from "react";
import { ArrowLeft, Check, Copy, ScanText, ShieldCheck } from "lucide-react";
import type { ClauseHeat, VariantResult } from "@/lib/types";

interface AdComparisonCardsProps {
  original: VariantResult;
  champion: VariantResult;
}

function clauseTone(score: number) {
  if (score >= 0.45) {
    return {
      row: "border-r-emerald-500 bg-emerald-500/[0.07] text-zinc-100",
      num: "text-emerald-400",
    };
  }
  if (score <= -0.35) {
    return {
      row: "border-r-red-500 bg-red-500/[0.08] text-zinc-100",
      num: "text-red-400",
    };
  }
  return {
    row: "border-r-zinc-700 bg-white/[0.02] text-zinc-300",
    num: "text-zinc-500",
  };
}

function HeatmapText({ heatmap }: { heatmap: ClauseHeat[] }) {
  return (
    <div className="space-y-1.5 mt-1">
      {heatmap.map((h, i) => {
        const tone = clauseTone(h.score);
        return (
          <div
            key={i}
            className={`border-r-2 rounded-l-md px-3 py-2 text-[13px] leading-[1.75] flex items-start justify-between gap-3 ${tone.row}`}
          >
            <span>{h.clause}</span>
            <span className={`text-[11px] font-semibold tabular-nums shrink-0 mt-0.5 ${tone.num}`} dir="ltr">
              {h.score >= 0 ? `+${h.score.toFixed(1)}` : h.score.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AdComparisonCards({ original, champion }: AdComparisonCardsProps) {
  const [showXray, setShowXray] = useState(false);
  const [copied, setCopied] = useState(false);

  const lift = champion.fitness - original.fitness;
  const hasHeatmap = Boolean(original.heatmap?.length || champion.heatmap?.length);

  const copyChampion = () => {
    const txt = `${champion.ad.headline}\n\n${champion.ad.body}\n\n[${champion.ad.cta}]`;
    navigator.clipboard?.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-zinc-500">مقایسه نسخه اصلی و قهرمان فعلی</span>
        <div className="flex items-center gap-2">
          {hasHeatmap && (
            <button
              type="button"
              onClick={() => setShowXray((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                showXray
                  ? "bg-white/[0.1] border-white/25 text-white"
                  : "bg-transparent border-white/[0.08] text-zinc-400 hover:text-zinc-100 hover:border-white/[0.16]"
              }`}
            >
              <ScanText className="w-3.5 h-3.5" />
              <span>{showXray ? "نمای عادی متن" : "ایکس‌ری جمله‌ها"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={copyChampion}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] bg-transparent text-zinc-400 hover:text-zinc-100 hover:border-white/[0.16] transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "کپی شد" : "کپی نسخه قهرمان"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_28px_1fr] gap-4 items-stretch">
        {/* ORIGINAL */}
        <article className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 text-xs text-zinc-400 tabular-nums">
                <span className="font-medium text-zinc-300">نسخه اصلی</span>
                <span className="text-zinc-700">·</span>
                <span>امتیاز {original.fitness.toFixed(1)}</span>
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                {typeof original.estCtrPct === "number" && <>~{original.estCtrPct}٪ CTR · </>}
                توقف {Math.round(original.stop)}٪ · اعتماد {Math.round(original.trust)}٪
              </span>
            </div>

            {original.ad.imageDataUrl && (
              <img
                src={original.ad.imageDataUrl}
                alt="تصویر تبلیغ"
                className="w-full max-h-44 object-cover rounded-lg border border-white/[0.08] mb-4"
              />
            )}

            {showXray && original.heatmap?.length ? (
              <HeatmapText heatmap={original.heatmap} />
            ) : (
              <div className="space-y-2.5">
                {(original.ad.platform === "instagram_story" || original.ad.platform === "instagram_reels") && (
                  <div className="text-[10.5px] font-medium text-sky-400">
                    {original.ad.platform === "instagram_story" ? "فریم ۱ استوری (قلاب)" : "قلاب ۰ تا ۳ ثانیه ریلز"}
                  </div>
                )}
                <h4 className="text-[17px] font-bold text-white leading-[1.45]">
                  {original.ad.headline}
                </h4>
                {(original.ad.platform === "instagram_story" || original.ad.platform === "instagram_reels") && (
                  <div className="text-[10.5px] font-medium text-zinc-500 pt-1">
                    {original.ad.platform === "instagram_story" ? "فریم ۲ (اثبات کوتاه)" : "سناریوی ۱۵ ثانیه"}
                  </div>
                )}
                <p className="text-[13.5px] text-zinc-300 leading-[1.8] whitespace-pre-line">
                  {original.ad.body}
                </p>
              </div>
            )}
          </div>

          {!showXray && (
            <div className="mt-5 pt-2">
              <span className="inline-block bg-[#2563EB] text-white text-xs font-medium px-4 py-2 rounded-lg">
                {original.ad.platform === "instagram_story"
                  ? `استیکر لینک: ${original.ad.cta}`
                  : original.ad.platform === "instagram_reels"
                    ? `فراخوان: ${original.ad.cta}`
                    : original.ad.cta}
              </span>
            </div>
          )}
        </article>

        {/* Quiet directional arrow */}
        <div className="hidden lg:flex items-center justify-center text-zinc-600">
          <ArrowLeft className="w-4 h-4" />
        </div>

        {/* CURRENT CHAMPION */}
        <article className="rounded-xl border bg-[#111113] p-5 sm:p-6 flex flex-col justify-between champion-surface">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 text-xs tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="font-semibold text-emerald-400">قهرمان فعلی</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">نسل {champion.generation}</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-200 font-medium">امتیاز {champion.fitness.toFixed(1)}</span>
              </div>

              {lift > 0.05 ? (
                <span className="text-xs font-semibold text-emerald-400 tabular-nums" dir="ltr">
                  +{lift.toFixed(1)}
                </span>
              ) : (
                <span className="text-[11px] text-zinc-500">نسخه پایه</span>
              )}
            </div>

            {champion.ad.imageDataUrl && (
              <img
                src={champion.ad.imageDataUrl}
                alt="تصویر تبلیغ"
                className="w-full max-h-44 object-cover rounded-lg border border-emerald-500/25 mb-4"
              />
            )}

            {showXray && champion.heatmap?.length ? (
              <HeatmapText heatmap={champion.heatmap} />
            ) : (
              <div className="space-y-2.5">
                {(champion.ad.platform === "instagram_story" || champion.ad.platform === "instagram_reels") && (
                  <div className="text-[10.5px] font-medium text-emerald-400">
                    {champion.ad.platform === "instagram_story" ? "فریم ۱ استوری (قلاب)" : "قلاب ۰ تا ۳ ثانیه ریلز"}
                  </div>
                )}
                <h4 className="text-[17px] font-bold text-white leading-[1.45]">
                  {champion.ad.headline}
                </h4>
                {(champion.ad.platform === "instagram_story" || champion.ad.platform === "instagram_reels") && (
                  <div className="text-[10.5px] font-medium text-zinc-500 pt-1">
                    {champion.ad.platform === "instagram_story" ? "فریم ۲ (اثبات کوتاه)" : "سناریوی ۱۵ ثانیه"}
                  </div>
                )}
                <p className="text-[13.5px] text-zinc-200 leading-[1.8] whitespace-pre-line">
                  {champion.ad.body}
                </p>
              </div>
            )}
          </div>

          {!showXray && (
            <div className="mt-5 pt-2 space-y-2.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="inline-block bg-[#2563EB] text-white text-xs font-medium px-4 py-2 rounded-lg">
                  {champion.ad.platform === "instagram_story"
                    ? `استیکر لینک: ${champion.ad.cta}`
                    : champion.ad.platform === "instagram_reels"
                      ? `فراخوان: ${champion.ad.cta}`
                      : champion.ad.cta}
                </span>
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  {typeof champion.estCtrPct === "number" && (
                    <>
                      <strong className="text-emerald-300">~{champion.estCtrPct}٪ CTR</strong> ·{" "}
                    </>
                  )}
                  {typeof champion.relevance === "number" && <>تناسب {Math.round(champion.relevance)}٪ · </>}
                  توقف {Math.round(champion.stop)}٪ · شفافیت {Math.round(champion.clarity)}٪ · اعتماد{" "}
                  {Math.round(champion.trust)}٪
                  {typeof champion.fitnessStd === "number" && champion.fitnessStd > 0 && (
                    <> · پراکندگی ±{champion.fitnessStd}</>
                  )}
                </span>
              </div>
              {champion.copyChief && (
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 flex-wrap text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {champion.copyChief.factVerified
                        ? "ممیزی واقعیت تایید شد"
                        : "نیازمند بازبینی ادعا"}
                      {champion.director ? ` · ${champion.director}` : ""}
                    </span>
                  </span>
                  <span className="text-zinc-400 tabular-nums">
                    {typeof champion.copyChief.briefFidelity === "number" ? (
                      <>
                        تطابق بریف: <strong className="text-sky-300">{champion.copyChief.briefFidelity}/100</strong>
                        {" · "}
                      </>
                    ) : typeof champion.copyChief.creativeSharpness === "number" ? (
                      <>
                        تیزی ایده: <strong className="text-sky-300">{champion.copyChief.creativeSharpness}/100</strong>
                        {" · "}
                      </>
                    ) : null}
                    فارسی بومی: <strong className="text-zinc-200">{champion.copyChief.persianCraft}/100</strong>
                  </span>
                </div>
              )}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
