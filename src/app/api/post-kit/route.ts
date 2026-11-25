import { NextRequest, NextResponse } from "next/server";
import { getRunById, loadCrowd, saveRun } from "@/lib/crowd-store";
import { generateLaunchKit, simulateInstagramComments } from "@/lib/deepseek";
import type { AdCopy, VoiceRegister } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action: "launch_kit" | "comments";
      runId?: string;
      ad?: AdCopy;
      productTruth?: string;
      voiceRegister?: VoiceRegister;
    };

    const existingRun = body.runId ? getRunById(body.runId) : null;
    const championAd = body.ad ?? existingRun?.champion.ad;
    const productTruth = body.productTruth ?? existingRun?.productTruth ?? "";
    const voiceRegister: VoiceRegister = body.voiceRegister ?? existingRun?.voiceRegister ?? "colloquial";

    if (!championAd?.headline || !championAd?.body) {
      return NextResponse.json({ error: "اطلاعات تبلیغ قهرمان یافت نشد." }, { status: 400 });
    }

    if (body.action === "launch_kit") {
      const lastTips = existingRun?.diagnoses
        ?.slice()
        .reverse()
        .find((d) => d.landingPageTips?.length)?.landingPageTips;

      const res = await generateLaunchKit({
        champion: championAd,
        productTruth,
        voiceRegister,
        splitSummary: existingRun?.splitAdvice?.summary,
        landingPageTips: lastTips,
      });

      if (existingRun) {
        existingRun.launchKit = res.kit;
        existingRun.totalTokens += res.tokens;
        existingRun.totalCostUsd = Number((existingRun.totalCostUsd + res.costUsd).toFixed(5));
        saveRun(existingRun);
      }

      return NextResponse.json({ launchKit: res.kit, costUsd: res.costUsd });
    }

    if (body.action === "comments") {
      const allCrowd = loadCrowd();
      const byId = new Map(allCrowd.map((p) => [p.id, p]));
      const judgments = existingRun?.champion.judgments ?? [];
      const sorted = [...judgments].sort((a, b) => a.fitness - b.fitness);

      const picks =
        sorted.length >= 4
          ? [
              ...sorted.slice(0, 2),
              ...sorted.slice(Math.floor(sorted.length * 0.25), Math.floor(sorted.length * 0.25) + 2),
              ...sorted.slice(Math.floor(sorted.length * 0.55), Math.floor(sorted.length * 0.55) + 2),
              ...sorted.slice(-2),
            ]
              .filter((j, idx, arr) => arr.findIndex((x) => x.personaId === j.personaId) === idx)
              .map((j) => ({ persona: byId.get(j.personaId)!, judgment: j }))
              .filter((x) => Boolean(x.persona))
              .slice(0, 8)
          : allCrowd.slice(0, 8).map((p) => ({
              persona: p,
              judgment: {
                personaId: p.id,
                name: p.name,
                age: p.age,
                gender: p.gender,
                city: p.city,
                neighborhood: p.neighborhood,
                city_tier: p.city_tier,
                job: p.job,
                income_tier: p.income_tier,
                monthly_income_m: p.monthly_income_m,
                ad_archetype: p.ad_archetype,
                stop: 0.6,
                click: 0.45,
                intent: 0.4,
                trust: 0.55,
                clarity: 0.7,
                reaction: "curious" as const,
                fitness: 50,
              },
            }));

      const res = await simulateInstagramComments({
        ad: championAd,
        productTruth,
        personas: picks,
      });

      if (existingRun) {
        existingRun.simulatedComments = res.comments;
        existingRun.totalTokens += res.tokens;
        existingRun.totalCostUsd = Number((existingRun.totalCostUsd + res.costUsd).toFixed(5));
        saveRun(existingRun);
      }

      return NextResponse.json({ comments: res.comments, costUsd: res.costUsd });
    }

    return NextResponse.json({ error: "عملیات نامعتبر است." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطا در تولید بسته انتشار";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
