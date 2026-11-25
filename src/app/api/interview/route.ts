import { NextRequest, NextResponse } from "next/server";
import { getPersonaById } from "@/lib/crowd-store";
import { interviewPersona } from "@/lib/deepseek";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const personaId = String(body.personaId ?? "");
    const userMessage = String(body.message ?? "").trim();
    const history = Array.isArray(body.history) ? body.history : [];

    const persona = getPersonaById(personaId);
    if (!persona) {
      return NextResponse.json({ error: "پرسونا یافت نشد." }, { status: 404 });
    }
    if (!userMessage) {
      return NextResponse.json({ error: "پیام نمی‌تواند خالی باشد." }, { status: 400 });
    }

    const res = await interviewPersona({
      persona,
      ad: body.ad,
      judgment: body.judgment,
      history,
      userMessage,
    });

    return NextResponse.json({
      reply: res.reply,
      ms: res.ms,
      costUsd: res.costUsd,
      persona: {
        id: persona.id,
        name: persona.name,
        city: persona.city,
        neighborhood: persona.neighborhood,
        age: persona.age,
        job: persona.job,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطا در مصاحبه با پرسونا";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
