import { NextRequest, NextResponse } from "next/server";
import { appendPersonasToCrowd, loadCrowd } from "@/lib/crowd-store";
import { generateCustomDeepPersonas } from "@/lib/deepseek";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const nicheDescription = String(body.nicheDescription ?? "").trim();
    const tag = String(body.tag ?? "").trim() || "گروه سفارشی";
    const count = Math.min(20, Math.max(4, Number(body.count ?? 10)));

    if (!nicheDescription || nicheDescription.length < 6) {
      return NextResponse.json({ error: "توضیح مخاطب هدف باید حداقل ۶ کاراکتر باشد." }, { status: 400 });
    }

    const existing = loadCrowd();
    const { profiles, costUsd } = await generateCustomDeepPersonas({
      nicheDescription,
      count,
      startIndex: existing.length,
      tag,
    });

    const combined = appendPersonasToCrowd(profiles);
    return NextResponse.json({
      added: profiles.length,
      total: combined.length,
      costUsd,
      profiles,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطا در ساخت پرسوناها";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
