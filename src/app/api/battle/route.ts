import { NextRequest, NextResponse } from "next/server";
import { filterCrowd, loadCrowd, splitTrainAndHoldout } from "@/lib/crowd-store";
import { evaluateBattleArena } from "@/lib/decider";
import type { AdCopy, AudienceFilters, BattleContenderInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      platform?: AdCopy["platform"];
      contenders: BattleContenderInput[];
      filters?: AudienceFilters;
      crowdSize?: number;
    };

    const rawContenders = Array.isArray(body.contenders) ? body.contenders.slice(0, 4) : [];
    const validContenders = rawContenders
      .map((c, idx) => ({
        id: String(c.id || `ad_${idx + 1}`),
        label: String(c.label || `نسخه ${idx + 1}`).trim(),
        ad: {
          headline: String(c.ad?.headline ?? "").trim(),
          body: String(c.ad?.body ?? "").trim(),
          cta: String(c.ad?.cta ?? "مشاهده").trim(),
          platform: body.platform ?? c.ad?.platform ?? "instagram_story",
          voiceRegister: c.ad?.voiceRegister,
          imageDataUrl: c.ad?.imageDataUrl,
        },
      }))
      .filter((c) => c.ad.headline.length >= 2 && c.ad.body.length >= 4);

    if (validContenders.length < 2) {
      return NextResponse.json({ error: "حداقل ۲ نسخه تبلیغ کامل برای نبرد لازم است." }, { status: 400 });
    }

    const crowd = loadCrowd();
    const matched = filterCrowd(crowd, body.filters);
    if (matched.length < 12) {
      return NextResponse.json(
        { error: `تعداد مخاطبان مطابق فیلتر (${matched.length} نفر) کمتر از حداقل ۱۲ نفر است.` },
        { status: 400 }
      );
    }

    const reqSize = Math.min(120, Math.max(24, Number(body.crowdSize ?? 60)));
    const { train } = splitTrainAndHoldout(matched, reqSize, 0, Date.now());
    const platform: NonNullable<AdCopy["platform"]> = body.platform ?? "instagram_story";

    const result = await evaluateBattleArena({
      contenders: validContenders,
      personas: train,
      platform,
    });

    return NextResponse.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطا در اجرای نبرد سریع A/B";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
