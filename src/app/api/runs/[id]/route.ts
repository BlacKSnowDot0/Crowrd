import { NextRequest, NextResponse } from "next/server";
import { deleteRunById, getRunById } from "@/lib/crowd-store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getRunById(id);
  if (!run) return NextResponse.json({ error: "تست یافت نشد" }, { status: 404 });
  return NextResponse.json({ run });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const removed = deleteRunById(id);
  if (!removed) return NextResponse.json({ error: "تست یافت نشد" }, { status: 404 });
  return NextResponse.json({ removed: true, id });
}
