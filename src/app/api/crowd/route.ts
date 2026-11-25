import { NextRequest, NextResponse } from "next/server";
import { filterCrowd, loadCrowd } from "@/lib/crowd-store";
import type { AudienceFilters } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const all = loadCrowd();
  const sp = req.nextUrl.searchParams;

  const filters: AudienceFilters = {
    cityTiers: sp.get("cityTiers") ? sp.get("cityTiers")!.split(",").filter(Boolean) : undefined,
    incomeTiers: sp.get("incomeTiers") ? sp.get("incomeTiers")!.split(",").filter(Boolean) : undefined,
    gender: (sp.get("gender") as AudienceFilters["gender"]) || undefined,
    minAge: sp.get("minAge") ? Number(sp.get("minAge")) : undefined,
    maxAge: sp.get("maxAge") ? Number(sp.get("maxAge")) : undefined,
    sectors: sp.get("sectors") ? sp.get("sectors")!.split(",").filter(Boolean) : undefined,
    archetypes: sp.get("archetypes") ? sp.get("archetypes")!.split(",").filter(Boolean) : undefined,
    customTag: sp.get("customTag") || undefined,
  };
  const q = sp.get("q") || undefined;
  const filtered = filterCrowd(all, filters, q);

  const countBy = (fn: (p: (typeof all)[number]) => string) => {
    const map: Record<string, number> = {};
    for (const p of all) {
      const k = fn(p);
      if (k) map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  };

  return NextResponse.json({
    total: all.length,
    matched: filtered.length,
    facets: {
      cityTiers: countBy((p) => p.city_tier),
      incomeTiers: countBy((p) => p.income_tier),
      sectors: countBy((p) => p.sector),
      archetypes: countBy((p) => p.ad_archetype),
      customTags: countBy((p) => p.custom_tag ?? ""),
    },
    profiles: filtered,
  });
}
