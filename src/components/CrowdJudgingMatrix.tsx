"use client";

import { useMemo, useState } from "react";
import type { PersonJudgment, ReactionCounts, ReactionType } from "@/lib/types";

interface CrowdJudgingMatrixProps {
  title?: string;
  subtitle?: string;
  isLive: boolean;
  totalExpected: number;
  judgments: PersonJudgment[];
  runningMetrics: {
    fitness: number;
    stop: number;
    click: number;
    intent: number;
    trust: number;
    naturalness?: number;
    clarity: number;
    reactions: ReactionCounts;
  } | null;
  onSelectPerson?: (judgment: PersonJudgment) => void;
}

const REACTION_META: Record<
  ReactionType,
  { label: string; dotClass: string; hex: string }
> = {
  annoyed: {
    label: "رد / کلافه",
    dotClass: "bg-red-500",
    hex: "#ef4444",
  },
  neutral: {
    label: "بی‌تفاوت",
    dotClass: "bg-zinc-500",
    hex: "#71717a",
  },
  curious: {
    label: "کنجکاو",
    dotClass: "bg-blue-500",
    hex: "#3b82f6",
  },
  excited: {
    label: "آماده اقدام",
    dotClass: "bg-emerald-500",
    hex: "#22c55e",
  },
};

export function CrowdJudgingMatrix({
  title = "جمعیت در حال قضاوت است",
  subtitle,
  isLive,
  totalExpected,
  judgments,
  runningMetrics,
  onSelectPerson,
}: CrowdJudgingMatrixProps) {
  const [hovered, setHovered] = useState<PersonJudgment | null>(null);
  const [filterReaction, setFilterReaction] = useState<ReactionType | "all">("all");

  const completed = judgments.length;
  const pct = totalExpected > 0 ? Math.min(100, Math.round((completed / totalExpected) * 100)) : 0;

  const slots = useMemo(() => {
    const count = Math.max(totalExpected, judgments.length);
    return Array.from({ length: count }, (_, idx) => judgments[idx] ?? null);
  }, [totalExpected, judgments]);

  const rx = runningMetrics?.reactions ?? { annoyed: 0, neutral: 0, curious: 0, excited: 0 };

  // Gracefully scale dot density from 36 up to 300+ personas
  const dotSizeClass =
    slots.length > 200
      ? "w-[7px] h-[7px]"
      : slots.length > 120
        ? "w-[9px] h-[9px]"
        : "w-[10px] h-[10px]";
  const dotGapClass =
    slots.length > 200
      ? "gap-[5px]"
      : slots.length > 120
        ? "gap-[6px]"
        : "gap-[7px]";

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isLive ? "bg-red-500 live-pulse" : "bg-emerald-500"
            }`}
          />
          <h3 className="text-[15px] font-semibold text-white truncate">{title}</h3>
          {subtitle && (
            <>
              <span className="hidden sm:inline text-zinc-700">·</span>
              <span className="hidden sm:inline text-xs text-zinc-500 truncate">{subtitle}</span>
            </>
          )}
        </div>

        <div className="flex items-baseline gap-4 shrink-0 tabular-nums">
          {runningMetrics && completed > 0 && (
            <span className="hidden sm:inline-flex items-baseline gap-1.5 text-xs text-zinc-500">
              <span>امتیاز</span>
              <strong className="text-sm font-semibold text-emerald-400">
                {runningMetrics.fitness.toFixed(1)}
              </strong>
            </span>
          )}
          <span
            className={`text-xl sm:text-2xl font-bold leading-none ${
              isLive ? "text-sky-400" : "text-white"
            }`}
          >
            {pct}٪
          </span>
        </div>
      </div>

      {/* Typographic KPI Row — flat on surface, zero nested cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-6 gap-y-4 pb-5 mb-4 border-b border-white/[0.06]">
        <div>
          <div className="text-xl sm:text-[24px] font-bold text-white leading-none tabular-nums inline-flex items-baseline" dir="ltr">
            <span>{completed}</span>
            <span className="text-zinc-500 text-sm font-normal">/{totalExpected}</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1.5">نفر بررسی شد</div>
        </div>

        <MetricColumn
          label="توقف روی تیتر"
          value={runningMetrics && completed > 0 ? `${Math.round(runningMetrics.stop)}٪` : "—"}
        />
        <MetricColumn
          label="احتمال کلیک"
          value={runningMetrics && completed > 0 ? `${Math.round(runningMetrics.click)}٪` : "—"}
        />
        <MetricColumn
          label="قصد اقدام"
          value={runningMetrics && completed > 0 ? `${Math.round(runningMetrics.intent)}٪` : "—"}
        />
        <MetricColumn
          label="اعتماد"
          value={runningMetrics && completed > 0 ? `${Math.round(runningMetrics.trust)}٪` : "—"}
          tone={runningMetrics && completed > 0 && runningMetrics.trust < 35 ? "danger" : "default"}
        />
        <MetricColumn
          label="کیفیت برند و کپی"
          value={
            runningMetrics && completed > 0
              ? `${Math.round(runningMetrics.naturalness ?? runningMetrics.clarity)}٪`
              : "—"
          }
          tone={
            runningMetrics && completed > 0 && (runningMetrics.naturalness ?? runningMetrics.clarity) < 55
              ? "danger"
              : "default"
          }
        />
      </div>

      {/* THE STADIUM DOT MATRIX */}
      <div className="rounded-lg border border-white/[0.06] bg-[#060608] px-4 py-4 mb-4">
        <div className={`flex flex-wrap ${dotGapClass} items-center`}>
          {slots.map((j, idx) => {
            if (!j) {
              return (
                <span
                  key={`empty-${idx}`}
                  className={`${dotSizeClass} rounded-full bg-zinc-800/80 inline-block`}
                />
              );
            }
            const meta = REACTION_META[j.reaction];
            const dimmed = filterReaction !== "all" && j.reaction !== filterReaction;
            return (
              <button
                key={j.personaId}
                type="button"
                onMouseEnter={() => setHovered(j)}
                onMouseLeave={() => setHovered((cur) => (cur?.personaId === j.personaId ? null : cur))}
                onFocus={() => setHovered(j)}
                onClick={() => onSelectPerson?.(j)}
                title={`${j.name} (${j.city}) — کلیک برای مصاحبه`}
                className={`${dotSizeClass} rounded-full inline-block dot-pop transition-transform duration-150 cursor-pointer hover:scale-[1.85] hover:ring-2 hover:ring-white/85 hover:z-20 focus:outline-none focus:ring-2 focus:ring-white/85 ${meta.dotClass} ${
                  dimmed ? "opacity-15 scale-75" : "opacity-100"
                }`}
              />
            );
          })}
        </div>

        {/* Fixed-height Hover Dossier Strip */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] min-h-[30px] flex items-center justify-between gap-3 text-xs">
          {hovered ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 w-full">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${REACTION_META[hovered.reaction].dotClass}`} />
                <span className="text-white font-semibold">{hovered.name}</span>
                <span className="text-zinc-400">
                  {hovered.age} ساله · {hovered.job} · {hovered.neighborhood}، {hovered.city}
                </span>
                <span className="text-zinc-500">· {hovered.ad_archetype}</span>
              </div>
              <div className="flex items-center gap-3.5 tabular-nums text-[11px] text-zinc-400 shrink-0">
                <span>
                  کلیک <strong className="text-zinc-100 font-semibold">{Math.round(hovered.click * 100)}٪</strong>
                </span>
                <span>
                  اعتماد{" "}
                  <strong
                    className={`font-semibold ${hovered.trust < 0.35 ? "text-red-400" : "text-zinc-100"}`}
                  >
                    {Math.round(hovered.trust * 100)}٪
                  </strong>
                </span>
                <span>
                  امتیاز <strong className="text-white font-semibold">{hovered.fitness.toFixed(0)}</strong>
                </span>
                <span className="text-sky-400">کلیک برای مصاحبه ←</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full text-zinc-500">
              <span>روی هر نقطه بروید تا مشخصات فرد نمایش داده شود؛ برای مصاحبه مستقیم کلیک کنید.</span>
              <span className="hidden md:inline text-[11px] tabular-nums">
                {slots.length.toLocaleString("fa-IR")} پروفایل
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Minimal Legend Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {(["annoyed", "neutral", "curious", "excited"] as ReactionType[]).map((type) => {
            const meta = REACTION_META[type];
            const active = filterReaction === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setFilterReaction(active ? "all" : type)}
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  active
                    ? "bg-white/[0.1] text-white"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.hex }} />
                <span>{meta.label}</span>
                <span className="tabular-nums font-semibold text-zinc-200">{rx[type]}</span>
              </button>
            );
          })}
          {filterReaction !== "all" && (
            <button
              type="button"
              onClick={() => setFilterReaction("all")}
              className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer px-2 py-1"
            >
              نمایش همه
            </button>
          )}
        </div>
      </div>

      {/* Crisp 2px Progress Track */}
      <div className="h-[2px] w-full bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isLive ? "bg-sky-400" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}

function MetricColumn({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div>
      <div
        className={`text-xl sm:text-[24px] font-bold leading-none tabular-nums ${
          tone === "danger" ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-zinc-500 mt-1.5">{label}</div>
    </div>
  );
}
