"use client";

import type { HoldoutResult } from "@/lib/types";

interface Point {
  gen: number;
  label: string;
  fitness: number;
  variantId: string;
}

interface EvolutionChartProps {
  history: Point[];
  holdout?: HoldoutResult;
}

export function EvolutionChart({ history, holdout }: EvolutionChartProps) {
  if (history.length === 0) return null;

  const best = Math.max(...history.map((h) => h.fitness));
  const orig = history[0].fitness;
  const lift = best - orig;

  const chartPoints = [
    ...history.map((h) => ({
      label: h.gen === 0 ? "g0" : `g${h.gen}`,
      sub: h.label,
      value: h.fitness,
      isHoldout: false,
    })),
    ...(holdout
      ? [{ label: "holdout", sub: "جمعیت پنهان", value: holdout.champion.fitness, isHoldout: true }]
      : []),
  ];

  const W = 760;
  const H = 196;
  const padL = 52;
  const padR = 44;
  const padT = 34;
  const padB = 34;

  const minVal = Math.max(0, Math.floor(Math.min(...chartPoints.map((p) => p.value), orig) - 10));
  const maxVal = Math.min(100, Math.ceil(Math.max(...chartPoints.map((p) => p.value), 50) + 10));
  const midVal = Math.round((minVal + maxVal) / 2);
  const span = Math.max(15, maxVal - minVal);

  const coords = chartPoints.map((pt, i) => {
    const x =
      chartPoints.length === 1
        ? (W + padL - padR) / 2
        : padL + (i / (chartPoints.length - 1)) * (W - padL - padR);
    const y = padT + (1 - (pt.value - minVal) / span) * (H - padT - padB);
    return { ...pt, x, y };
  });

  const trainCoords = coords.filter((c) => !c.isHoldout);
  const polyline = trainCoords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPath =
    trainCoords.length > 1
      ? `M ${trainCoords[0].x},${H - padB} ` +
        trainCoords.map((c) => `L ${c.x},${c.y}`).join(" ") +
        ` L ${trainCoords[trainCoords.length - 1].x},${H - padB} Z`
      : "";

  const yTicks = [
    { ratio: 0, label: maxVal },
    { ratio: 0.5, label: midVal },
    { ratio: 1, label: minVal },
  ];

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[13px] font-semibold text-zinc-200">روند امتیاز قهرمان در هر نسل</h3>
          <div className="inline-flex items-baseline gap-1.5 text-xs tabular-nums">
            <span className="text-zinc-500">بهترین</span>
            <span className="font-semibold text-white">{best.toFixed(1)}</span>
            {lift > 0.05 && (
              <span className="text-emerald-400 font-medium" dir="ltr">
                +{lift.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono tabular-nums" dir="ltr">
          CrowdPull × BrandCraft Gate
        </span>
      </div>

      <div className="w-full overflow-x-auto" dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px] h-[196px]">
          <defs>
            <linearGradient id="crowdEvoArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {yTicks.map((tick, idx) => {
            const y = padT + tick.ratio * (H - padT - padB);
            return (
              <g key={idx}>
                <line
                  x1={padL - 8}
                  x2={W - padR + 8}
                  y1={y}
                  y2={y}
                  stroke={idx === 2 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)"}
                  strokeWidth="1"
                  strokeDasharray={idx === 2 ? undefined : "3 4"}
                />
                <text
                  x={padL - 16}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#52525b"
                  fontSize="10"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill="url(#crowdEvoArea)" />}

          {trainCoords.length > 1 && (
            <polyline
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline}
            />
          )}

          {holdout && trainCoords.length > 0 && coords.length > trainCoords.length && (
            <line
              x1={trainCoords[trainCoords.length - 1].x}
              y1={trainCoords[trainCoords.length - 1].y}
              x2={coords[coords.length - 1].x}
              y2={coords[coords.length - 1].y}
              stroke="#38bdf8"
              strokeWidth="1.75"
              strokeDasharray="4 4"
            />
          )}

          {coords.map((c, idx) => (
            <g key={idx}>
              <circle
                cx={c.x}
                cy={c.y}
                r={c.isHoldout ? 5.5 : 5}
                fill={c.isHoldout ? "#38bdf8" : "#22c55e"}
                stroke="#111113"
                strokeWidth="2.5"
              />
              <text
                x={c.x}
                y={c.y - 12}
                textAnchor="middle"
                fill={c.isHoldout ? "#7dd3fc" : "#fafafa"}
                fontSize="12"
                fontWeight="600"
              >
                {c.value.toFixed(1)}
              </text>
              <text
                x={c.x}
                y={H - 10}
                textAnchor="middle"
                fill={c.isHoldout ? "#38bdf8" : "#71717a"}
                fontSize="11"
                fontWeight="500"
              >
                {c.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
