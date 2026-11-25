"use client";

import { Trash2 } from "lucide-react";

export interface RunSummary {
  id: string;
  createdAt: string;
  title: string;
  trainCount: number;
  holdoutCount: number;
  originalFitness: number;
  championFitness: number;
  holdoutOriginalFitness?: number;
  holdoutChampionFitness?: number;
  generationsCount: number;
  totalCostUsd: number;
}

interface RunsHistoryProps {
  runs: RunSummary[];
  onOpenRun: (id: string) => void;
  onDeleteRun: (id: string) => void;
}

export function RunsHistory({ runs, onOpenRun, onDeleteRun }: RunsHistoryProps) {
  if (runs.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center rounded-xl border border-white/[0.08] bg-[#111113] p-12 space-y-2">
        <div className="text-base font-semibold text-white">هنوز تستی ذخیره نشده است</div>
        <p className="text-[13px] text-zinc-400 leading-relaxed">
          از بخش «تست تبلیغ» اولین آزمایش خود را اجرا کنید تا نتایج کامل، هیت‌مپ و تایید جمعیت پنهان اینجا ثبت شود.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">تاریخچه آزمایش‌ها</h1>
        <p className="text-[13px] text-zinc-400 mt-1">
          برای باز کردن جزئیات نسل‌ها، ماتریس نقاط و مصاحبه با پروفایل‌ها روی هر ردیف کلیک کنید.
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#111113] divide-y divide-white/[0.06] overflow-hidden">
        {runs.map((r) => {
          const lift = r.championFitness - r.originalFitness;
          const hLift =
            typeof r.holdoutChampionFitness === "number" && typeof r.holdoutOriginalFitness === "number"
              ? r.holdoutChampionFitness - r.holdoutOriginalFitness
              : null;
          return (
            <div
              key={r.id}
              onClick={() => onOpenRun(r.id)}
              className="px-5 py-4 hover:bg-white/[0.025] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
            >
              <div className="space-y-1 min-w-0">
                <h3 className="text-[14px] font-semibold text-zinc-100 truncate">{r.title}</h3>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500 tabular-nums">
                  <span>{new Date(r.createdAt).toLocaleString("fa-IR")}</span>
                  <span className="text-zinc-700">·</span>
                  <span>
                    {r.trainCount} آموزش + {r.holdoutCount} پنهان
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span>{r.generationsCount} نسل</span>
                  <span className="text-zinc-700">·</span>
                  <span className="font-mono text-zinc-400" dir="ltr">
                    ${r.totalCostUsd.toFixed(4)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-5 shrink-0 tabular-nums">
                {hLift !== null && (
                  <div className="hidden md:flex items-baseline gap-1.5 text-xs">
                    <span className="text-zinc-500">پنهان</span>
                    <span className={`font-semibold ${hLift >= 0 ? "text-sky-400" : "text-red-400"}`} dir="ltr">
                      {hLift >= 0 ? `+${hLift.toFixed(1)}` : hLift.toFixed(1)}
                    </span>
                  </div>
                )}

                <div className="flex items-baseline gap-2 text-xs" dir="ltr">
                  <span className="text-zinc-500">{r.originalFitness.toFixed(1)}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="text-sm font-bold text-white">{r.championFitness.toFixed(1)}</span>
                  <span
                    className={`text-xs font-semibold ${lift >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {lift >= 0 ? `+${lift.toFixed(1)}` : lift.toFixed(1)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRun(r.id);
                  }}
                  title="حذف آزمایش"
                  aria-label="حذف آزمایش"
                  className="p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
