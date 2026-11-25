"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, X } from "lucide-react";
import type { AdCopy, Persona, PersonJudgment } from "@/lib/types";

interface PersonaInterviewDrawerProps {
  persona: Persona | null;
  judgment?: PersonJudgment | null;
  ad?: AdCopy | null;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  "دقیقاً چه چیزی در این تبلیغ باعث این واکنش شد؟",
  "چه تغییری در متن یا قیمت باعث می‌شود کلیک کنی؟",
  "به کدام بخش متن اعتماد نکردی؟",
  "اگر این تبلیغ را در فید ببینی واقعاً چه کار می‌کنی؟",
];

export function PersonaInterviewDrawer({ persona, judgment, ad, onClose }: PersonaInterviewDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [persona?.id, ad?.headline]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!persona) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [persona, onClose]);

  if (!persona) return null;

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const nextHistory: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: persona.id,
          ad: ad ?? undefined,
          judgment: judgment ?? undefined,
          history: messages,
          message: trimmed,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "خطا در دریافت پاسخ");
      setMessages([...nextHistory, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطای ارتباط");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75" onClick={onClose}>
      <aside
        className="w-full max-w-lg h-full bg-[#0D0D10] border-r border-white/[0.08] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Profile Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.08] bg-[#111113]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-100 font-semibold text-base shrink-0 border border-white/[0.1]"
                style={{ backgroundColor: `hsl(${persona.avatar_hue}, 18%, 18%)` }}
              >
                {persona.name.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h3 className="text-[15px] font-bold text-white">{persona.name}</h3>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {persona.gender} · {persona.age} ساله
                  </span>
                </div>
                <div className="text-xs text-zinc-400 mt-0.5 truncate">
                  {persona.neighborhood}، {persona.city} ({persona.province})
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="بستن"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Structured metadata strip — zero badge soup */}
          <div className="mt-3.5 text-xs text-zinc-400 leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-zinc-200 font-medium">{persona.job}</span>
            <span className="text-zinc-700">·</span>
            <span className="tabular-nums">
              درآمد {persona.monthly_income_m} میلیون ({persona.income_tier})
            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-300">{persona.ad_archetype}</span>
            <span className="text-zinc-700">·</span>
            <span>
              {persona.marital_status}، {persona.housing}
            </span>
          </div>

          {/* Decider verdict strip when opened from a run */}
          {judgment && (
            <div className="mt-4 pt-3.5 border-t border-white/[0.06] grid grid-cols-4 gap-3 tabular-nums">
              <div>
                <div className="text-[11px] text-zinc-500">توقف</div>
                <div className="font-semibold text-white text-sm mt-0.5">{Math.round(judgment.stop * 100)}٪</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">کلیک</div>
                <div className="font-semibold text-white text-sm mt-0.5">{Math.round(judgment.click * 100)}٪</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">قصد اقدام</div>
                <div className="font-semibold text-emerald-400 text-sm mt-0.5">{Math.round(judgment.intent * 100)}٪</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">اعتماد</div>
                <div
                  className={`font-semibold text-sm mt-0.5 ${
                    judgment.trust < 0.35 ? "text-red-400" : "text-white"
                  }`}
                >
                  {Math.round(judgment.trust * 100)}٪
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Dossier + Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Editorial Dossier */}
          <div className="pb-5 border-b border-white/[0.06] space-y-3 text-[13px] leading-[1.8] text-zinc-300">
            <div className="text-[11px] font-medium text-zinc-500">پرونده پروفایل</div>
            <p>{persona.life_story}</p>
            <blockquote className="text-xs text-zinc-400 border-r-2 border-white/20 pr-3 leading-[1.75]">
              «{persona.voice_sample}»
            </blockquote>

            <div className="space-y-2 pt-1 text-xs">
              {persona.triggers.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-300">
                  <span className="text-zinc-500 text-[11px]">محرک‌ها:</span>
                  {persona.triggers.map((t, i) => (
                    <span key={`t-${i}`} className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{t}</span>
                    </span>
                  ))}
                </div>
              )}
              {persona.red_flags.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-300">
                  <span className="text-zinc-500 text-[11px]">خط قرمزها:</span>
                  {persona.red_flags.map((r, i) => (
                    <span key={`r-${i}`} className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      <span>{r}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Starter questions */}
          {messages.length === 0 && (
            <div className="space-y-2.5">
              <div className="text-xs text-zinc-500">مصاحبه مستقیم با {persona.name}:</div>
              <div className="flex flex-col gap-1.5">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="text-xs text-right px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-[#111113] text-zinc-300 hover:text-white hover:border-white/[0.18] transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[86%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-[1.8] ${
                    m.role === "user"
                      ? "bg-white/[0.09] text-white"
                      : "bg-[#141417] border border-white/[0.08] text-zinc-200"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="bg-[#141417] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                  <span>{persona.name} در حال نوشتن پاسخ...</span>
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/25 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-3.5 border-t border-white/[0.08] bg-[#111113] flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`سوالی از ${persona.name} بپرسید...`}
            className="flex-1 bg-[#09090B] border border-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="ارسال"
            className="p-2 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-35 text-zinc-950 transition-colors cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </form>
      </aside>
    </div>
  );
}
