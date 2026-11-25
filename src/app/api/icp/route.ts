import { NextRequest, NextResponse } from "next/server";
import { filterCrowd, loadCrowd } from "@/lib/crowd-store";
import { detectAutoICP } from "@/lib/deepseek";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ad = body.ad;
    const productTruth = String(body.productTruth ?? "");

    if (!ad?.headline && !ad?.body && !productTruth.trim()) {
      return NextResponse.json({ error: "برای تشخیص مخاطب هدف، متن تبلیغ یا توضیح محصول را وارد کنید." }, { status: 400 });
    }

    const all = loadCrowd();
    const availableSectors = Array.from(new Set(all.map((p) => p.sector))).sort();
    const availableCityTiers = ["تهران", "کلان‌شهر", "مرکز استان", "شهرستان"];
    const availableIncomeTiers = ["کم‌درآمد", "متوسط رو به پایین", "متوسط", "متوسط رو به بالا", "مرفه"];

    const result = await detectAutoICP({
      ad: {
        headline: String(ad?.headline ?? ""),
        body: String(ad?.body ?? ""),
        cta: String(ad?.cta ?? ""),
        platform: ad?.platform ?? "instagram",
      },
      productTruth,
      availableSectors,
      availableCityTiers,
      availableIncomeTiers,
    });

    // Safety fallback: if DeepSeek's filter combo matches fewer than 40 people, relax sectors first so training+holdout has plenty of depth
    let finalFilters = { ...result.filters };
    let matched = filterCrowd(all, finalFilters);
    if (matched.length < 40 && finalFilters.sectors) {
      finalFilters = { ...finalFilters, sectors: undefined };
      matched = filterCrowd(all, finalFilters);
    }
    if (matched.length < 40 && finalFilters.incomeTiers) {
      finalFilters = { ...finalFilters, incomeTiers: undefined };
      matched = filterCrowd(all, finalFilters);
    }

    return NextResponse.json({
      filters: finalFilters,
      matchedCount: matched.length,
      totalCount: all.length,
      icpLabel: result.icpLabel,
      rationale: result.rationale,
      recommendedRegister: result.recommendedRegister,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطا در تشخیص خودکار مخاطب هدف";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
