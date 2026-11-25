import { NextRequest, NextResponse } from "next/server";
import { filterCrowd, loadCrowd, splitTrainAndHoldout } from "@/lib/crowd-store";
import { evaluatePriceElasticity } from "@/lib/decider";
import { suggestPriceOffers } from "@/lib/deepseek";
import type { AudienceFilters, PriceOfferOption } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action: "suggest" | "evaluate";
      productName: string;
      productDescription: string;
      basePriceToman?: number;
      offers?: PriceOfferOption[];
      filters?: AudienceFilters;
      crowdSize?: number;
    };

    const productName = String(body.productName ?? "").trim();
    const productDescription = String(body.productDescription ?? "").trim();

    if (!productName || !productDescription) {
      return NextResponse.json({ error: "نام و توضیح محصول الزامی است." }, { status: 400 });
    }

    if (body.action === "suggest") {
      const basePriceToman = Math.max(10_000, Number(body.basePriceToman ?? 390_000));
      const res = await suggestPriceOffers({ productName, productDescription, basePriceToman });
      return NextResponse.json(res);
    }

    if (body.action === "evaluate") {
      const offers = Array.isArray(body.offers) ? body.offers.slice(0, 6) : [];
      if (offers.length < 2) {
        return NextResponse.json({ error: "حداقل ۲ پیشنهاد قیمتی برای مقایسه لازم است." }, { status: 400 });
      }
      const crowd = loadCrowd();
      const matched = filterCrowd(crowd, body.filters);
      if (matched.length < 12) {
        return NextResponse.json({ error: `تعداد مخاطبان مطابق فیلتر (${matched.length}) کافی نیست.` }, { status: 400 });
      }
      const reqSize = Math.min(200, Math.max(24, Number(body.crowdSize ?? 75)));
      const { train } = splitTrainAndHoldout(matched, reqSize, 0, Date.now());

      const result = await evaluatePriceElasticity({
        productName,
        productDescription,
        offers,
        personas: train,
      });

      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "عملیات نامعتبر است." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطا در آزمایشگاه کشش قیمتی";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
