"use client";

import { useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  Copy,
  Layers,
  Loader2,
  MessageSquareText,
  Radio,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type {
  AdCopy,
  CounterfactualXrayResult,
  FeedBattleResult,
  FunnelCandidate,
  LaunchKit,
  SimulatedComment,
  SocialContagionResult,
  VoiceRegister,
} from "@/lib/types";

interface PostLaunchPanelProps {
  runId?: string;
  championAd: AdCopy;
  productTruth: string;
  voiceRegister?: VoiceRegister;
  funnelCandidates?: FunnelCandidate[];
  feedBattle?: FeedBattleResult;
  socialContagion?: SocialContagionResult;
  counterfactualXray?: CounterfactualXrayResult;
  comments?: SimulatedComment[];
  launchKit?: LaunchKit;
  isRunning: boolean;
  onCommentsGenerated: (comments: SimulatedComment[]) => void;
  onLaunchKitGenerated: (kit: LaunchKit) => void;
  onOpenPersona: (personaId: string) => void;
}

const TONE_LABELS: Record<SimulatedComment["tone"], { label: string; cls: string }> = {
  troll: { label: "تند / ترول", cls: "text-red-400 border-red-500/30 bg-red-500/[0.08]" },
  skeptic: { label: "شکاک", cls: "text-amber-300 border-amber-500/30 bg-amber-500/[0.08]" },
  price_check: { label: "قیمت‌سنج", cls: "text-sky-300 border-sky-500/30 bg-sky-500/[0.08]" },
  curious: { label: "کنجکاو", cls: "text-zinc-300 border-white/[0.12] bg-white/[0.04]" },
  buyer: { label: "آماده خرید", cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.08]" },
};

export function PostLaunchPanel({
  runId,
  championAd,
  productTruth,
  voiceRegister,
  funnelCandidates,
  feedBattle,
  socialContagion,
  counterfactualXray,
  comments,
  launchKit,
  isRunning,
  onCommentsGenerated,
  onLaunchKitGenerated,
  onOpenPersona,
}: PostLaunchPanelProps) {
  const [showFunnel, setShowFunnel] = useState(true);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [kitTab, setKitTab] = useState<"story" | "reels" | "telegram" | "yektanet">("story");
  const [kitLoading, setKitLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1600);
  };

  const handleGenerateKit = async () => {
    if (kitLoading) return;
    setLocalError(null);
    setKitLoading(true);
    try {
      const resp = await fetch("/api/post-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "launch_kit",
          runId,
          ad: championAd,
          productTruth,
          voiceRegister,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "خطا در تولید کیت انتشار");
      onLaunchKitGenerated(data.launchKit);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "خطا در تولید کیت انتشار");
    } finally {
      setKitLoading(false);
    }
  };

  const handleGenerateComments = async () => {
    if (commentsLoading) return;
    setLocalError(null);
    setCommentsLoading(true);
    try {
      const resp = await fetch("/api/post-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "comments",
          runId,
          ad: championAd,
          productTruth,
          voiceRegister,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "خطا در شبیه‌سازی کامنت‌ها");
      onCommentsGenerated(data.comments);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "خطا در شبیه‌سازی کامنت‌ها");
    } finally {
      setCommentsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* A. 4-Director Creative Room + Copy Chief + Fast Funnel */}
      {funnelCandidates && funnelCandidates.length > 0 && (
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowFunnel((v) => !v)}
            className="w-full px-5 sm:px-6 py-4 flex items-center justify-between gap-3 text-right hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <Layers className="w-4 h-4 text-sky-400 shrink-0" />
              <h3 className="text-[13px] font-semibold text-zinc-100">
                اتاق خلاقیت ۴ کارگردان و ممیزی سردبیر کپی (نسل ۱)
              </h3>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                · {funnelCandidates.length} ایده تولید شد ←{" "}
                {funnelCandidates.filter((c) => c.selected).length} فینالیست وارد قضاوت کامل شدند
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-zinc-500 transition-transform shrink-0 ${showFunnel ? "rotate-180" : ""}`}
            />
          </button>

          {showFunnel && (
            <div className="border-t border-white/[0.06] divide-y divide-white/[0.05]">
              {funnelCandidates.map((c) => (
                <div
                  key={c.id}
                  className={`px-5 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    c.selected ? "bg-emerald-500/[0.03]" : "opacity-65"
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          c.selected ? "bg-emerald-400" : "bg-zinc-700"
                        }`}
                      />
                      <span className="text-[11px] text-sky-400 font-medium">{c.director}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-[13px] font-semibold text-zinc-100">{c.ad.headline}</span>
                      {c.factVerified ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-400">
                          <ShieldCheck className="w-3 h-3" />
                          تطابق واقعیت
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-amber-400">نیازمند بازبینی ادعا</span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-zinc-400 pr-3.5 leading-relaxed">
                      <span className="text-zinc-500">یادداشت سردبیر: </span>
                      {c.redPenNote}
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 shrink-0 text-[11.5px] tabular-nums pr-3.5 sm:pr-0 flex-wrap">
                    {typeof c.tournamentSharePct === "number" && (
                      <span className="text-zinc-400">
                        سهم تورنمنت <strong className="text-emerald-300">{c.tournamentSharePct}٪</strong>
                      </span>
                    )}
                    {typeof c.creativeSharpness === "number" && (
                      <span className="text-zinc-400">
                        تطابق بریف <strong className="text-sky-300">{Math.round(c.creativeSharpness)}</strong>
                      </span>
                    )}
                    <span className="text-zinc-400">
                      توقف تیتر <strong className="text-zinc-100">{Math.round(c.headlineStopPct)}٪</strong>
                    </span>
                    <span className="text-zinc-400">
                      فارسی <strong className="text-zinc-100">{Math.round(c.persianCraft)}</strong>
                    </span>
                    <span
                      className={`text-[11px] font-medium min-w-[68px] text-left ${
                        c.selected ? "text-emerald-400" : "text-zinc-500"
                      }`}
                    >
                      {c.selected ? "فینالیست" : "حذف در غربال"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* B. Simulated 4-Post Iranian Feed Battle */}
      {feedBattle && (
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-[13px] font-semibold text-zinc-100">
                  آزمون شلوغی فید واقعی در برابر ۳ رقیب ایرانی
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  سهم توجه تبلیغ شما وقتی همزمان کنار ۳ تبلیغ رقیب در فید {feedBattle.voterCount} مخاطب قرار می‌گیرد (چهار جایگاه متوازن بدون سوگیری ترتیب)
                </p>
              </div>
            </div>

            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-[11px] text-zinc-500">رشد سهم توجه:</span>
              <span
                className={`text-sm font-bold ${
                  feedBattle.shareLiftPct >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
                dir="ltr"
              >
                {feedBattle.shareLiftPct >= 0 ? `+${feedBattle.shareLiftPct}%` : `${feedBattle.shareLiftPct}%`}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FeedBar
                label="نسخه اصلی در فید"
                value={feedBattle.originalSharePct}
                sub={`بی‌تفاوت به کل فید: ${feedBattle.originalNeitherPct}٪`}
                tone="zinc"
              />
              <FeedBar
                label="قهرمان نهایی در فید"
                value={feedBattle.championSharePct}
                sub={`بی‌تفاوت به کل فید: ${feedBattle.championNeitherPct}٪`}
                tone="emerald"
              />
              <FeedBar
                label="میانگین هر رقیب ایرانی"
                value={feedBattle.competitorAvgPct}
                sub={`در برابر ${feedBattle.competitors.length} رقیب همین بازار`}
                tone="sky"
              />
            </div>

            <div className="pt-2 border-t border-white/[0.05]">
              <button
                type="button"
                onClick={() => setShowCompetitors((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11.5px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <span>مشاهده ۳ تبلیغ رقیبی که در فید رقابت کردند</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCompetitors ? "rotate-180" : ""}`} />
              </button>

              {showCompetitors && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  {feedBattle.competitors.map((comp, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-white/[0.06] bg-[#0B0B0D] p-3.5 space-y-1.5"
                    >
                      <div className="text-[11px] font-semibold text-zinc-400">{comp.brand}</div>
                      <div className="text-xs font-semibold text-zinc-200 leading-snug">{comp.headline}</div>
                      <p className="text-[11.5px] text-zinc-400 leading-[1.7]">{comp.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* V6-A: Counterfactual Causal Ablation X-Ray (Hook vs Offer + Broad Scaling) */}
      {counterfactualXray && (
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <h3 className="text-[13px] font-semibold text-zinc-100">
                  کالبدشکافی علّی (تیتر در برابر متن و پیشنهاد + مقیاس‌پذیری)
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  آزمایش خلاف‌واقع روی {counterfactualXray.voterCount} مخاطب: دقیقاً چند درصد رشد از تیتر بود و چند درصد از متن/پیشنهاد؟
                </p>
              </div>
            </div>
            <div className="text-xs font-semibold tabular-nums text-sky-300">
              تیتر {counterfactualXray.hookSharePct}٪ · پیشنهاد و متن {counterfactualXray.offerSharePct}٪
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
              <div className="rounded-lg border border-white/[0.06] bg-[#0B0B0D] p-3.5">
                <div className="text-[11px] text-zinc-500">نسخه اصلی</div>
                <div className="text-lg font-bold text-zinc-300 mt-1">{counterfactualXray.originalScore}</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-[#0B0B0D] p-3.5">
                <div className="text-[11px] text-zinc-500">فقط تیتر جدید</div>
                <div className="text-lg font-bold text-sky-300 mt-1">
                  {counterfactualXray.hookOnlyScore}
                  <span className="text-[11px] font-medium mr-1.5" dir="ltr">
                    ({counterfactualXray.hookLift >= 0 ? "+" : ""}
                    {counterfactualXray.hookLift})
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-[#0B0B0D] p-3.5">
                <div className="text-[11px] text-zinc-500">فقط متن/پیشنهاد جدید</div>
                <div className="text-lg font-bold text-violet-300 mt-1">
                  {counterfactualXray.offerOnlyScore}
                  <span className="text-[11px] font-medium mr-1.5" dir="ltr">
                    ({counterfactualXray.offerLift >= 0 ? "+" : ""}
                    {counterfactualXray.offerLift})
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-3.5">
                <div className="text-[11px] text-emerald-400">ترکیب کامل قهرمان</div>
                <div className="text-lg font-bold text-emerald-300 mt-1">{counterfactualXray.championScore}</div>
              </div>
            </div>

            {counterfactualXray.broadOutsideScore !== null && (
              <div className="rounded-lg border border-white/[0.06] bg-[#0B0B0D] px-4 py-3 flex items-center justify-between gap-3 flex-wrap text-xs">
                <span className="text-zinc-300 leading-relaxed">{counterfactualXray.scaleVerdict}</span>
                <span className="text-zinc-400 tabular-nums shrink-0">
                  ICP: <strong className="text-zinc-100">{counterfactualXray.tightIcpScore}</strong> · خارج از فیلتر:{" "}
                  <strong className="text-zinc-200">{counterfactualXray.broadOutsideScore}</strong>
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* V6-B: 2nd-Order Social Contagion (Comment-Section Stress Test + Admin Recovery + Dark-Social Share) */}
      {socialContagion && (
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Share2 className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-[13px] font-semibold text-zinc-100">
                  سرایت اجتماعی کامنت‌ها و وایرالیتی دارک‌سوشال (2nd-Order Contagion)
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  تأثیر واقعی {socialContagion.attackCommentCount} کامنت شکاک بی‌پاسخ زیر پست، میزان بازیابی با پاسخ ادمین و احتمال فوروارد در تلگرام/دایرکت ({socialContagion.voterCount} مخاطب)
                </p>
              </div>
            </div>
            <div className="text-xs font-semibold tabular-nums text-sky-300">
              احتمال فوروارد (Dark Social): {socialContagion.darkSocialSharePct}٪
            </div>
          </div>

          <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-3.5 tabular-nums">
            <div className="rounded-lg border border-white/[0.06] bg-[#0B0B0D] p-4 space-y-1.5">
              <div className="text-[11px] text-zinc-500">۱. حالت پایه (بدون کامنت)</div>
              <div className="text-sm font-semibold text-zinc-100">
                اعتماد {socialContagion.baselineTrustPct}٪ · کلیک {socialContagion.baselineClickPct}٪
              </div>
              <div className="text-[11px] text-zinc-500">واکنش سرد قبل از باز کردن بخش کامنت‌ها</div>
            </div>

            <div className="rounded-lg border border-red-500/25 bg-red-500/[0.04] p-4 space-y-1.5">
              <div className="text-[11px] text-red-400">۲. زیر حمله کامنت‌های شکاک (بی‌پاسخ)</div>
              <div className="text-sm font-semibold text-red-300">
                اعتماد {socialContagion.underAttackTrustPct}٪{" "}
                <span className="text-[11px]" dir="ltr">
                  ({socialContagion.trustDropPct > 0 ? "+" : ""}
                  {socialContagion.trustDropPct}٪)
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                کلیک {socialContagion.underAttackClickPct}٪ ({socialContagion.clickDropPct > 0 ? "+" : ""}
                {socialContagion.clickDropPct}٪)
              </div>
            </div>

            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-emerald-400">۳. بعد از پاسخ شفاف ادمین</span>
                {socialContagion.repliesOptimized && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    بهینه‌سازی خودکار ✓
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-emerald-300">
                اعتماد {socialContagion.afterReplyTrustPct}٪{" "}
                <span className="text-[11px]" dir="ltr">
                  ({socialContagion.trustRecoveryPct >= 0 ? "+" : ""}
                  {socialContagion.trustRecoveryPct}٪)
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                کلیک {socialContagion.afterReplyClickPct}٪ ({socialContagion.clickRecoveryPct >= 0 ? "+" : ""}
                {socialContagion.clickRecoveryPct}٪ بازیابی)
              </div>
            </div>
          </div>

          {socialContagion.transparencyGapWarning && (
            <div className="px-5 sm:px-6 pb-5">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-200 leading-relaxed">
                <strong className="text-amber-300">هشدار شکاف شفافیت محصول: </strong>
                {socialContagion.transparencyGapWarning}
              </div>
            </div>
          )}
        </section>
      )}

      {/* C. Instagram Comment-Section Simulator + Admin Defense Playbook */}
      {!isRunning && (
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <MessageSquareText className="w-4 h-4 text-zinc-300 shrink-0" />
              <div>
                <h3 className="text-[13px] font-semibold text-zinc-100">
                  پیش‌بینی کامنت‌های زیر پست + پاسخ آماده ادمین
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  شبیه‌سازی کامنت‌های واقعی ایرانی‌ها (شکاک، قیمت‌سنج، ترول و خریدار) همراه با پاسخ استاندارد برند
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateComments}
              disabled={commentsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] bg-[#16161A] hover:bg-[#1E1E24] disabled:opacity-50 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
            >
              {commentsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>{comments?.length ? "شبیه‌سازی مجدد کامنت‌ها" : "شبیه‌سازی کامنت‌های زیر پست"}</span>
            </button>
          </div>

          {comments && comments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:gap-px bg-white/[0.05]">
              {comments.map((cm, idx) => {
                const toneInfo = TONE_LABELS[cm.tone] ?? TONE_LABELS.curious;
                const cKey = `reply_${idx}`;
                return (
                  <div key={`${cm.personaId}_${idx}`} className="bg-[#111113] p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenPersona(cm.personaId)}
                        className="text-xs font-semibold text-zinc-200 hover:text-sky-400 transition-colors cursor-pointer text-right"
                      >
                        {cm.name}{" "}
                        <span className="text-[11px] font-normal text-zinc-500">
                          · {cm.age}س، {cm.city} ({cm.job})
                        </span>
                      </button>
                      <span className={`text-[10.5px] px-2 py-0.5 rounded border shrink-0 ${toneInfo.cls}`}>
                        {toneInfo.label}
                      </span>
                    </div>

                    <p className="text-[13px] text-zinc-100 leading-[1.75] bg-[#0B0B0D] border border-white/[0.06] rounded-lg px-3.5 py-2.5">
                      «{cm.comment}»
                    </p>

                    <div className="border-r-2 border-r-emerald-500/60 pr-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-emerald-400">پاسخ پیشنهادی ادمین</span>
                        <button
                          type="button"
                          onClick={() => copyText(cKey, cm.suggestedReply)}
                          className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-200 cursor-pointer"
                        >
                          {copiedKey === cKey ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedKey === cKey ? "کپی شد" : "کپی"}</span>
                        </button>
                      </div>
                      <p className="text-xs text-zinc-300 leading-[1.75]">{cm.suggestedReply}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-6 text-xs text-zinc-500 text-center">
              برای مشاهده کامنت‌های احتمالی زیر پست و پاسخ آماده ادمین روی دکمه بالا کلیک کنید.
            </div>
          )}
        </section>
      )}

      {/* D. Multi-Platform Iranian Launch Kit */}
      {!isRunning && (
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <h3 className="text-[13px] font-semibold text-zinc-100">
                  کیت انتشار چندکاناله (استوری · ریلز · تلگرام · یکتانت)
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  تبدیل پیام قهرمان نهایی به فرمت آماده انتشار در ۴ کانال اصلی ایران با deepseek-flash (حداکثر عمق)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateKit}
              disabled={kitLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 text-xs font-semibold transition-colors cursor-pointer"
            >
              {kitLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>{launchKit ? "بازتولید کیت انتشار" : "تولید کیت آماده انتشار"}</span>
            </button>
          </div>

          {localError && (
            <div className="px-5 py-3 text-xs text-red-400 bg-red-500/[0.06] border-b border-red-500/20">
              {localError}
            </div>
          )}

          {launchKit ? (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-1.5 flex-wrap border-b border-white/[0.06] pb-3">
                {(
                  [
                    ["story", "استوری ۳ فریمی"],
                    ["reels", "هوک ۳ ثانیه ریلز"],
                    ["telegram", "پست کانال تلگرام"],
                    ["yektanet", "همسان یکتانت"],
                  ] as const
                ).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKitTab(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      kitTab === k
                        ? "bg-white/[0.1] text-white font-semibold"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {kitTab === "story" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {launchKit.storyFrames.map((f) => (
                    <div
                      key={f.frame}
                      className="rounded-lg border border-white/[0.08] bg-[#0B0B0D] p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-sky-400 font-semibold">فریم {f.frame} · {f.role}</span>
                          <button
                            type="button"
                            onClick={() => copyText(`st_${f.frame}`, f.text)}
                            className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
                          >
                            {copiedKey === `st_${f.frame}` ? "کپی شد" : "کپی"}
                          </button>
                        </div>
                        <p className="text-[13px] font-semibold text-white leading-[1.75]">{f.text}</p>
                        <p className="text-[11.5px] text-zinc-400 leading-relaxed">
                          <span className="text-zinc-500">قاب تصویر: </span>
                          {f.visualNote}
                        </p>
                      </div>
                      {f.sticker && (
                        <div className="pt-2 border-t border-white/[0.06]">
                          <span className="inline-block text-[11px] bg-white/[0.08] text-zinc-100 px-2.5 py-1 rounded">
                            استیکر لینک: {f.sticker}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {kitTab === "reels" && (
                <div className="rounded-lg border border-white/[0.08] bg-[#0B0B0D] p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-400">ثانیه ۰ تا ۳ (قلاب قفل‌کننده)</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          "reels",
                          `${launchKit.reelsHook.seconds0to3}\n\n${launchKit.reelsHook.caption}`
                        )
                      }
                      className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                      {copiedKey === "reels" ? "کپی شد" : "کپی متن ریلز"}
                    </button>
                  </div>
                  <div className="text-[15px] font-bold text-white leading-[1.6]">
                    «{launchKit.reelsHook.seconds0to3}»
                  </div>
                  <div className="text-xs text-zinc-400 leading-relaxed">
                    <span className="text-zinc-500 font-medium">صحنه و حرکت تصویر: </span>
                    {launchKit.reelsHook.visualAction}
                  </div>
                  <div className="pt-3 border-t border-white/[0.06] text-xs text-zinc-300 leading-[1.8] whitespace-pre-line">
                    <span className="text-zinc-500 block mb-1">کپشن پیشنهادی:</span>
                    {launchKit.reelsHook.caption}
                  </div>
                </div>
              )}

              {kitTab === "telegram" && (
                <div className="rounded-lg border border-white/[0.08] bg-[#0B0B0D] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-400">پست آماده کانال تلگرام</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          "tg",
                          `${launchKit.telegramPost.headline}\n\n${launchKit.telegramPost.body}\n\n${launchKit.telegramPost.cta}`
                        )
                      }
                      className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                      {copiedKey === "tg" ? "کپی شد" : "کپی پست تلگرام"}
                    </button>
                  </div>
                  <div className="text-[15px] font-bold text-white">{launchKit.telegramPost.headline}</div>
                  <p className="text-[13px] text-zinc-200 leading-[1.9] whitespace-pre-line">
                    {launchKit.telegramPost.body}
                  </p>
                  <div className="text-xs text-sky-400 font-medium pt-1">{launchKit.telegramPost.cta}</div>
                </div>
              )}

              {kitTab === "yektanet" && (
                <div className="rounded-lg border border-white/[0.08] bg-[#0B0B0D] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-400">تبلیغ همسان یکتانت (محدودیت کاراکتر)</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          "yk",
                          `${launchKit.yektanetAd.title}\n${launchKit.yektanetAd.subtitle}\n[${launchKit.yektanetAd.cta}]`
                        )
                      }
                      className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                      {copiedKey === "yk" ? "کپی شد" : "کپی همسان"}
                    </button>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[15px] font-bold text-white">{launchKit.yektanetAd.title}</div>
                    <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                      {launchKit.yektanetAd.title.length} کاراکتر
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-[1.8]">{launchKit.yektanetAd.subtitle}</p>
                  <div>
                    <span className="inline-block bg-[#2563EB] text-white text-xs font-medium px-3.5 py-1.5 rounded-md">
                      {launchKit.yektanetAd.cta}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-5 text-xs text-zinc-500">
              روی «تولید کیت آماده انتشار» کلیک کنید تا نسخه برنده به سناریوی استوری، هوک ریلز، پست تلگرام و تبلیغ یکتانت تبدیل و در این آزمایش ذخیره شود.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function FeedBar({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "zinc" | "emerald" | "sky";
}) {
  const barCls =
    tone === "emerald" ? "bg-emerald-400" : tone === "sky" ? "bg-sky-400" : "bg-zinc-400";
  const valCls =
    tone === "emerald" ? "text-emerald-400" : tone === "sky" ? "text-sky-300" : "text-zinc-200";
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0B0B0D] p-4 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className={`text-lg font-bold tabular-nums ${valCls}`} dir="ltr">
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.min(100, Math.max(4, value * 1.4))}%` }} />
      </div>
      <div className="text-[11px] text-zinc-500 tabular-nums">{sub}</div>
    </div>
  );
}
