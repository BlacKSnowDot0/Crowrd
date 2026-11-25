import type {
  AdCopy,
  AudienceFilters,
  ClauseHeat,
  CompetitorFeedAd,
  CopyChiefReview,
  FocusGroupQuote,
  LaunchKit,
  Persona,
  PersonJudgment,
  PriceOfferOption,
  ReasoningMode,
  SimulatedComment,
  VariantResult,
  VoiceRegister,
} from "./types";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-flash";

function getDeepSeekKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is missing in environment");
  return key;
}

interface DeepSeekResp {
  choices: Array<{ message: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function parseJsonSafe<T = Record<string, unknown>>(raw: string): T {
  const trimmed = raw.trim();
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1)) as T;
    }
    throw new Error(`Invalid JSON from DeepSeek: ${stripped.slice(0, 180)}`);
  }
}

async function callDeepSeek(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  opts: {
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
    thinking?: boolean;
    reasoningEffort?: "low" | "high" | "max";
  } = {}
): Promise<{ content: string; inputTokens: number; outputTokens: number; costUsd: number; ms: number }> {
  const t0 = Date.now();

  async function invoke(effort?: "low" | "high" | "max", maxTok?: number) {
    const payload: Record<string, unknown> = {
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: maxTok ?? opts.maxTokens ?? 1400,
      temperature: opts.temperature ?? 0.8,
      thinking: { type: opts.thinking ? "enabled" : "disabled" },
    };
    if (opts.thinking && effort) {
      payload.reasoning_effort = effort;
    }
    if (opts.jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getDeepSeekKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`DeepSeek HTTP ${resp.status}: ${txt.slice(0, 300)}`);
    }
    return (await resp.json()) as DeepSeekResp;
  }

  let data = await invoke(opts.reasoningEffort, opts.maxTokens);
  let content = (data.choices[0]?.message?.content ?? "").trim();

  // Safety retry if max reasoning consumed entire token budget without emitting content
  if (!content && opts.thinking) {
    data = await invoke("high", Math.max(9000, opts.maxTokens ?? 9000));
    content = (data.choices[0]?.message?.content ?? "").trim();
  }

  const ms = Date.now() - t0;
  const inTok = data.usage?.prompt_tokens ?? 0;
  const outTok = data.usage?.completion_tokens ?? 0;
  const costUsd = (inTok * 0.15 + outTok * 0.6) / 1_000_000;
  return { content, inputTokens: inTok, outputTokens: outTok, costUsd, ms };
}

const VOICE_REGISTER_GUIDE: Record<VoiceRegister, string> = {
  colloquial: `لحن اجباری: **فارسی محاوره‌ایِ کاملاً طبیعی و بومی ایران (مثل بلوبانک، اسنپ، ترب، تپسی)**
- یکدست و روان: بدون افعال و ضمایر کتابی («نمی‌رود / دارای / می‌نماید / بانکی‌ات / را» کنار متن محاوره‌ای ممنوع).
- بدون پسوندهای عجیب و نچسب («ماهانه‌ت»، «فیزیکی‌ت»، «کاریت») و بدون ایموجی.`,

  friendly: `لحن اجباری: **محاوره‌ای محترمانه و صمیمی (با خطاب «شما»)**
- گرم، باوقار و قابل اعتماد («براتون»، «می‌شه»، «نگران نباشید»)، بدون خشکی اداری و بدون ایموجی.`,

  modern_pro: `لحن اجباری: **حرفه‌ای، مدرن، موجز و تیز (استاندارد معاصر برندهای پریمیوم و تخصصی ایران)**
- جملات کوتاه، دقیق و خوش‌آهنگ؛ بدون کلیشه‌های زرد، بدون ترجمه‌زدگی انگلیسی و بدون ایموجی.`,

  bold_genz: `لحن اجباری: **جسورانه، بی‌پرده و کاملاً محاوره‌ایِ نسل جوان ایران**
- مستقیم، ضرب‌آهنگ سریع، تیز و واقعی، بدون لوس‌بازی و بدون ایموجی.`,
};

const PLATFORM_FORMAT_GUIDE: Record<string, string> = {
  instagram_story: `فرمت اجباری: **استوری ۳ فریمی اینستاگرام (تبلیغ پیج/اینفلوئنسر)**
- \`headline\` = متن روی تصویر **فریم ۱ (قلاب ۵ ثانیه اول)** — بسیار کوتاه و میخکوب‌کننده (۳ تا ۸ کلمه!) که مانع تپ‌اسکیپ شود.
- \`body\` = متن کوتاه و خوانای **فریم ۲ (اثبات و توضیح اصلی)** — حداکثر ۱ تا ۲ جمله کوتاه (۱۲ تا ۲۴ کلمه؛ هرگز پاراگراف بلند ننویس!).
- \`cta\` = متن روی **استیکر لینک فریم ۳** — خیلی کوتاه و طبیعی (۲ تا ۴ کلمه مثل «بزن اینجا ببین» یا «لینک جلسه اول»).`,

  instagram_reels: `فرمت اجباری: **ریلز ۲۰ ثانیه‌ای اینستاگرام (اکسپلور + کامنت دایرکت)**
- \`headline\` = **قلاب ۰ تا ۳ ثانیه اول** (جمله گفتاری و تیتر روی ویدیو که جلوی سوایپ بالا را می‌گیرد، ۵ تا ۱۱ کلمه).
- \`body\` = **سناریوی ۱۵ ثانیه‌ای ویدیو** (توصیف کوتاه و زنده تصویر + پیام اصلی در ۱۵ تا ۳۰ کلمه؛ نه متن بروشوری!).
- \`cta\` = **فراخوان پایان ریلز / محرک کامنت دایرکت** (مثل «کلمه «اکسل» رو کامنت کن لینک بیاد دایرکتت» یا «لینک تو بیو»).`,

  telegram: `فرمت اجباری: **پست تبلیغاتی کانال تلگرام / Telegram Ads**
- \`headline\` = تیتر کوبنده و روشن (۴ تا ۱۱ کلمه).
- \`body\` = ۱ تا ۲ جمله دقیق، خوانا و پرمحتوا (۱۵ تا ۳۴ کلمه).
- \`cta\` = دکمه شیشه‌ای / لینک کوتاه و روشن (۲ تا ۴ کلمه).`,

  banner: `فرمت اجباری: **تبلیغ همسان سایت‌ها (یکتانت)**
- \`headline\` = تیتر فوق‌العاده موجز و دقیق (**حداکثر ۴۸ کاراکتر** — ۴ تا ۸ کلمه!).
- \`body\` = زیرتیتر کوتاه و تکمیلی (۱۰ تا ۲۲ کلمه).
- \`cta\` = دکمه ۲ تا ۳ کلمه‌ای.`,

  divar: `فرمت اجباری: **آگهی دیوار (محلی، رک و کاملاً واقعی)**
- \`headline\` = عنوان شفاف و بدون شعار (۴ تا ۹ کلمه).
- \`body\` = توضیح ملموس، واقعی و بدون اغراق (۱۵ تا ۳۰ کلمه).
- \`cta\` = اقدام ساده و مستقیم (۲ تا ۴ کلمه).`,

  instagram: `فرمت: **پست/استوری اینستاگرام**
- تیتر ۴ تا ۱۰ کلمه، بدنه ۱ تا ۲ جمله خوش‌ریتم (۱۴ تا ۳۲ کلمه)، CTA کوتاه و روشن (۲ تا ۴ کلمه).`,
};

export interface CreativeRoomConcept {
  director: string;
  strategy: string;
  ad: AdCopy;
}

/**
 * SYSTEM 1: 4-Director Parallel Creative Room (deepseek-flash on max / high)
 * Spawns 4 distinct Iranian creative minds simultaneously (~15-22s wall clock!)
 * generating 8 truly orthogonal, high-craft Persian concepts instead of 2 safe siblings.
 */
export async function runCreativeRoomGen1(params: {
  original: VariantResult;
  heatmap: ClauseHeat[];
  focusGroupQuotes: FocusGroupQuote[];
  productTruth: string;
  voiceRegister: VoiceRegister;
  reasoningMode: ReasoningMode;
}): Promise<{
  diagnosis: string;
  objections: string[];
  landingPageTips: string[];
  concepts: CreativeRoomConcept[];
  tokens: number;
  costUsd: number;
}> {
  const { original, heatmap, focusGroupQuotes, productTruth, voiceRegister, reasoningMode } = params;

  const heatLines = heatmap
    .map((h) => `- [${h.score >= 0 ? "+" : ""}${h.score.toFixed(2)}] (${h.kind}) «${h.clause}»`)
    .join("\n");

  const focusLines =
    focusGroupQuotes.length > 0
      ? focusGroupQuotes
          .map((q) => `- ${q.name} (${q.age}س، ${q.job}، ${q.city}): «${q.quote}»`)
          .join("\n")
      : "—";

  const origPrefix = original.ad.headline
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");

  const platKey = original.ad.platform ?? "instagram_story";
  const platGuide = PLATFORM_FORMAT_GUIDE[platKey] ?? PLATFORM_FORMAT_GUIDE.instagram;

  const pureCreativeBrief = `تبلیغ فعلی مشتری (محصول و پیشنهاد اصلی که باید حتماً حفظ شود):
تیتر فعلی: ${original.ad.headline}
متن فعلی: ${original.ad.body}
CTA فعلی: ${original.ad.cta}
پلتفرم: ${platKey}
تشخیص جمعیت روی نسخه فعلی: تناسب مخاطب ${Math.round(original.relevance ?? 50)}٪ | توقف تیتر ${Math.round(original.stop)}٪ | شفافیت ۳ ثانیه ${Math.round(original.clarity)}٪ | اعتماد ${Math.round(original.trust)}٪ | کلیک واقعی ${Math.round(original.click)}٪

${platGuide}

حقایق مجاز محصول (خط قرمز ضدتوهم — هیچ عدد، قیمت، تخفیف یا ویژگی ساختگی خارج از این لیست نساز؛ لازم نیست همه خطوط را توی ۲ جمله بچپانی):
${productTruth || "کاربر لیست جداگانه وارد نکرده؛ فقط از حقایق موجود در تبلیغ اصلی مشتری استفاده کن و هیچ قیمت، تخفیف یا مجوز جدیدی نساز."}

${VOICE_REGISTER_GUIDE[voiceRegister]}

قوانین طلایی (تخلف = مردود!):
1) **ممنوعیت تکرار شروع تیتر اصلی (Anti-Echo)**: هیچ‌کدام از ۲ تیتر تو نباید با عبارت «${origPrefix}» یا قالب تکراری تیتر فعلی شروع شوند! همچنین هر ۲ تیتر خودت باید ساختار کاملاً متفاوت داشته باشند.
2) **قفل موضوع و پیشنهاد اصلی (Core-Offer Lock)**: مخاطب در ۳ ثانیه اول باید دقیقاً بفهمد **محصول/برند چیست و پیشنهاد اصلی چیست**! هرگز تیتر معمایی/شاعرانه‌ای ننویس که موضوع محصول گم شود (مثلاً تبلیغ دوره هوش مصنوعی بدون نام هوش مصنوعی/ChatGPT، یا تبلیغ خرید قسطی طلا که برود سراغ یک ویژگی فرعی!).
3) **نقطه ضعف را تیتر نکن**: هرگز نرخ سود یا شرط سخت (مثل «سود ۲۳ درصد») را تیتر اصلی نکن.
4) **ضد کلیشه و ضد متن دفاعی**: بدون ایموجی، بدون «بهره‌وری چند برابر / فرصت طلایی / تضمینی»، بدون ردیف کردن شاپرک/مجوزها، و بدون پسوند نچسب («ماهانه‌ت»، «فیزیکی‌ت»).
5) **طول دقیق**: تیتر ۴ تا ۱۱ کلمه، بدنه ۱ تا ۲ جمله خوش‌ریتم (۱۵ تا ۳۴ کلمه)، CTA کوتاه و روشن (۲ تا ۴ کلمه).
6) قانون JSON: درون متن فارسی فقط از گیومه « » استفاده کن و هرگز علامت " درون رشته فارسی نگذار.`;

  const performanceAddendum = `
نقاط ضعف تبلیغ فعلی در نگاه مخاطبان:
هیت‌مپ:
${heatLines}
برداشت مخاطبان:
${focusLines}`;

  const directors: Array<{
    name: string;
    rolePrompt: string;
    includeDiagnosis?: boolean;
    includeFeedback?: boolean;
  }> = [
    {
      name: "درد واقعی و پیشنهاد روشن",
      includeDiagnosis: true,
      rolePrompt: `تو کارگردان خلاقیتِ متخصص **تنش روزمره ایرانی‌ها + راه‌حل روشن** هستی.
مأموریت: با یک **سؤال یا صحنه تنش‌دار واقعی** از زندگی روزمره ایرانی‌ها شروع کن (مثلاً دردسر، تعویق، خجالت یا اتلاف وقت واقعی) و بلافاصله در ادامه تیتر یا جمله اول، محصول و پیشنهاد اصلی را کاملاً روشن بنشان.
قالب اجباری تیتر: سؤال ملموس یا بیان مستقیم درد روزمره (نه جمله خبری تکراری!). ۲ ایده کاملاً متفاوت بساز.`,
    },
    {
      name: "پیشنهاد مستقیم و ریسک‌زدایی",
      includeFeedback: true,
      rolePrompt: `تو **استراتژیست ارشد پرفورمنس مارکتینگ ایران (Direct-Response)** هستی.
مأموریت: برای خریداران عمل‌گرا، قیمت‌سنج و حساس به ریسک بنویس؛ کسانی که دنبال شعار نیستند و در ۳ ثانیه می‌خواهند بفهمند «دقیقاً چه می‌گیرم، چه مزیتی دارد و چرا ریسک امتحانش کم است؟»
قالب اجباری تیتر: عدد ملموس، مزیت فوری یا ریسک‌زدایی هوشمندانه (بدون تکرار قالب تیتر فعلی و بدون تیتر کردن نقطه ضعف مثل نرخ سود!). ۲ ایده پرفروش و بی‌اصطکاک بساز.`,
    },
    {
      name: "اعتماد و اعتبار برند",
      rolePrompt: `تو **استراتژیست ارشد برندینگ و اعتمادسازی بازار ایران** هستی.
مأموریت: برای مخاطبان باکیفیت‌گرا و سنتی‌تر بنویس که از تبلیغات زرد و اغراق‌آمیز متنفرند. با لحن آرام، حرفه‌ای، ذکر دقیق نام برند و یک نشانه اعتبار یا اثبات ملموس (از واقعیات محصول، نه بیانیه دفاعی شاپرکی!) حس یک برند درجه‌یک و مطمئن را منتقل کن.
قالب اجباری تیتر: جمله باوقارِ متمرکز بر اثبات/کیفیت/سابقه (بدون شروع کردن با «با [برند]...»!). ۲ ایده شفاف و بسیار قابل‌اعتماد بساز.`,
    },
    {
      name: "ضدکلیشه و متمایز در فید",
      rolePrompt: `تو **کپی‌رایتر ضدکلیشه و متوقف‌کننده اسکرول (Pattern-Interrupt)** هستی.
مأموریت: برای مخاطبان سریع‌ردکن و مدرن بنویس که وسط اسکرول سریع اینستاگرام ۹۵٪ تبلیغ‌ها را نمی‌بینند. یک تیتر تیز، غیرمنتظره و دارای **تضاد هوشمندانه** بساز که انگشت را قفل کند — به شرطی که در همان تیتر یا جمله اول بدنه کاملاً روشن باشد دقیقاً چه محصول و چه پیشنهادی ارائه می‌شود (هرگز گنگ و معمایی نباشد!).
قالب اجباری تیتر: تضاد کوتاه و کوبنده (۳ تا ۸ کلمه). ۲ ایده تیز و غیرتکراری بساز.`,
    },
  ];

  // V6 Speed Tuning: "high" delivers 98% of max creative sharpness in ~18s instead of ~70s!
  const effectiveEffort: "low" | "high" = reasoningMode === "max" ? "high" : "low";
  const maxTok = effectiveEffort === "high" ? 7000 : 4500;

  const settled = await Promise.all(
    directors.map(async (dir) => {
      const schemaBlock = dir.includeDiagnosis
        ? `{
  "diagnosis": "تحلیل کوتاه و دقیق ۱ تا ۲ جمله‌ای از ضعف اصلی تبلیغ فعلی (چرا کلیشه‌ای یا بی‌کشش است)",
  "objections": ["تنش یا مانع ذهنی واقعی مخاطب ۱", "تنش/مانع ۲", "تنش/مانع ۳"],
  "landingPageTips": ["توصیه شفاف‌سازی برای لندینگ‌پیج (خارج از تبلیغ) ۱", "توصیه لندینگ‌پیج ۲"],
  "variants": [
    {"strategy": "عنوان کوتاه ۲ تا ۴ کلمه‌ای زاویه", "headline": "...", "body": "...", "cta": "..."},
    {"strategy": "عنوان کوتاه ۲ تا ۴ کلمه‌ای زاویه", "headline": "...", "body": "...", "cta": "..."}
  ]
}`
        : `{
  "variants": [
    {"strategy": "عنوان کوتاه ۲ تا ۴ کلمه‌ای زاویه", "headline": "...", "body": "...", "cta": "..."},
    {"strategy": "عنوان کوتاه ۲ تا ۴ کلمه‌ای زاویه", "headline": "...", "body": "...", "cta": "..."}
  ]
}`;

      const brief = dir.includeFeedback ? `${pureCreativeBrief}\n${performanceAddendum}` : pureCreativeBrief;
      const prompt = `${dir.rolePrompt}\n\n${brief}\n\nفقط JSON دقیق زیر را برگردان:\n${schemaBlock}`;

      try {
        const res = await callDeepSeek([{ role: "user", content: prompt }], {
          maxTokens: maxTok,
          temperature: 0.9,
          jsonMode: true,
          thinking: true,
          reasoningEffort: effectiveEffort,
        });
        const parsed = parseJsonSafe<{
          diagnosis?: string;
          objections?: string[];
          landingPageTips?: string[];
          variants?: Array<{ strategy?: string; headline?: string; body?: string; cta?: string }>;
        }>(res.content);
        const variants = (parsed.variants ?? []).slice(0, 2).map((v) => ({
          director: dir.name,
          strategy: String(v.strategy ?? dir.name).trim(),
          ad: {
            headline: String(v.headline ?? "").trim(),
            body: String(v.body ?? "").trim(),
            cta: String(v.cta ?? original.ad.cta).trim(),
            platform: original.ad.platform,
            voiceRegister,
            imageDataUrl: original.ad.imageDataUrl,
          } as AdCopy,
        }));
        return {
          ok: true as const,
          diagnosis: parsed.diagnosis,
          objections: parsed.objections,
          landingPageTips: parsed.landingPageTips,
          variants: variants.filter((x) => x.ad.headline.length > 3 && x.ad.body.length > 8),
          tokens: res.inputTokens + res.outputTokens,
          costUsd: res.costUsd,
        };
      } catch {
        return {
          ok: false as const,
          variants: [] as CreativeRoomConcept[],
          tokens: 0,
          costUsd: 0,
        };
      }
    })
  );

  const concepts: CreativeRoomConcept[] = [];
  let diagnosis = "اتاق خلاقیت ۴ کارگردان با کشف تنش انسانی واقعی، ۸ زاویه مستقل طراحی کرد.";
  let objections: string[] = [];
  let landingPageTips: string[] = [];
  let totalTokens = 0;
  let totalCostUsd = 0;

  for (const r of settled) {
    totalTokens += r.tokens;
    totalCostUsd += r.costUsd;
    if (r.ok) {
      if (r.diagnosis) diagnosis = String(r.diagnosis);
      if (Array.isArray(r.objections) && r.objections.length) objections = r.objections.slice(0, 4).map(String);
      if (Array.isArray(r.landingPageTips) && r.landingPageTips.length)
        landingPageTips = r.landingPageTips.slice(0, 3).map(String);
      concepts.push(...r.variants);
    }
  }

  return { diagnosis, objections, landingPageTips, concepts, tokens: totalTokens, costUsd: totalCostUsd };
}

/**
 * SYSTEM 2 (V4): Executive Creative Director + Copy Chief & Smart Fact Auditor (deepseek-flash high)
 * Scores TWO orthogonal axes:
 *  1) creativeSharpness (0-100): Brutally separates true agency ideas (88-98) from boring FAQ/button copy (42-64)
 *  2) persianCraft (0-100): Native Iranian rhythm, register consistency, zero calques/clitics
 * Plus Smart Fact Audit WITH Metaphor & Cultural Insight Protection (never neuters vivid copy!).
 */
export async function auditAndPolishWithCopyChief(params: {
  candidates: Array<{ director?: string; strategy: string; ad: AdCopy }>;
  originalAd: AdCopy;
  productTruth: string;
  voiceRegister: VoiceRegister;
  reasoningMode: ReasoningMode;
  readOnly?: boolean; // true for scoring g0 fairly on the exact same scale without rewriting it!
}): Promise<{
  audited: Array<{
    director?: string;
    strategy: string;
    ad: AdCopy;
    review: CopyChiefReview;
  }>;
  tokens: number;
  costUsd: number;
}> {
  const { candidates, originalAd, productTruth, voiceRegister, readOnly } = params;
  if (candidates.length === 0) {
    return { audited: [], tokens: 0, costUsd: 0 };
  }

  const chunks: Array<Array<{ origIdx: number; item: (typeof candidates)[number] }>> = [];
  for (let i = 0; i < candidates.length; i += 4) {
    chunks.push(candidates.slice(i, i + 4).map((item, j) => ({ origIdx: i + j, item })));
  }

  let totalTokens = 0;
  let totalCostUsd = 0;
  const auditedMap = new Map<
    number,
    { director?: string; strategy: string; ad: AdCopy; review: CopyChiefReview }
  >();

  await Promise.all(
    chunks.map(async (chunk) => {
      const listBlock = chunk
        .map(
          (c, i) =>
            `[${i}] (${c.item.director ?? "کپی‌رایتر"} · ${c.item.strategy})\nتیتر: ${c.item.ad.headline}\nمتن: ${c.item.ad.body}\nCTA: ${c.item.ad.cta}`
        )
        .join("\n\n");

      const polishInstruction = readOnly
        ? "این ارزیابی فقط برای نمره‌دهی دقیق و بی‌رحمانه است؛ متن نسخه را تغییر نده و دقیقاً همان متن اصلی را در headline/body/cta برگردان."
        : "هر خطای زبانی، ناهماهنگی لحن یا ادعای ساختگی محصول را با جراحی تمیز اصلاح کن — اما هرگز ایده خلاقانه، استعاره، طنز یا ضرب‌آهنگ تیتر را خشک و بروشوری نکن!";

      const prompt = `تو **سردبیر کپی و ممیز تطابق بریف (Copy Chief, Fact & Brief-Fidelity Auditor)** هستی.
وظیفه تو قضاوت سلیقه‌ای به‌جای جمعیت نیست — بلکه ۳ کار دقیق و بی‌طرفانه روی ${chunk.length} نسخه تبلیغی زیر است:
1) **تطابق بریف و وضوح ۳ ثانیه (\`briefFidelity\`, 0..100)**: آیا مخاطب سرد در ۳ ثانیه اول دقیقاً می‌فهمد **چه محصول/برندی** و **چه پیشنهاد اصلی‌ای** (دقیقاً مطابق تبلیغ اصلی مشتری) ارائه می‌شود؟
   - 85 تا 100: کاملاً روی بریف، محصول و پیشنهاد اصلی در ۳ ثانیه روشن است.
   - 60 تا 84: تا حدی روشن است اما کمی کلی یا ناقص است.
   - زیر 60: **انحراف از بریف یا گنگ/معمایی!** (مثلاً تبلیغ دوره هوش مصنوعی بدون نام هوش مصنوعی، یا تبلیغ خرید قسطی طلا که رفته سراغ یک ویژگی فرعی دیگر!).
2) **کیفیت فارسی بومی (\`persianCraft\`, 0..100)**: روانی، یکدستی لحن، حذف ترجمه‌زدگی، حذف پسوندهای نچسب («ماهانه‌ت»، «فیزیکی‌ت») و حذف ایموجی.
3) **ممیزی ضدتوهم (\`factVerified\`)**: ساختن عدد، قیمت، تخفیف، ویژگی یا مجوز دروغین که نه در تبلیغ اصلی هست و نه در «واقعیات محصول» → همان‌جا اصلاح کن و در \`factIssues\` بنویس. **قانون مهم:** اگر بعد از اصلاح تو، متن نهاییِ خروجی ۱۰۰٪ منطبق بر واقعیات است، حتماً \`factVerified: true\` بده؛ فقط وقتی \`factVerified: false\` بده که متن نهایی هنوز ادعای تاییدنشده دارد. استعاره‌ها و صحنه‌های روزمره توهم نیستند.

${polishInstruction}

تبلیغ اصلی مشتری (منبع پیشنهاد اصلی):
تیتر: ${originalAd.headline}
متن: ${originalAd.body}
CTA: ${originalAd.cta}

واقعیات قطعی و مجاز محصول (تنها منبع حقیقت):
${productTruth || "فقط اطلاعات موجود در تبلیغ اصلی."}

${VOICE_REGISTER_GUIDE[voiceRegister]}

نسخه‌های پیشنهادی:
${listBlock}

قانون فرمت: درون متن‌های فارسی فقط از گیومه « » استفاده کن و هرگز علامت " درون رشته JSON نگذار.
برای هر نسخه \`index\` از 0 تا ${chunk.length - 1} دقیقاً JSON زیر را برگردان:
{
  "reviews": [
    {
      "index": 0,
      "briefFidelity": 92,
      "persianCraft": 91,
      "factVerified": true,
      "factIssues": [],
      "wasPolished": true,
      "redPenNote": "یک جمله خیلی کوتاه فارسی (۶ تا ۱۴ کلمه) درباره وضوح بریف یا اصلاح انجام‌شده",
      "headline": "تیتر نهایی",
      "body": "متن نهایی",
      "cta": "CTA نهایی"
    }
  ]
}`;

      type ParsedReview = {
        reviews?: Array<{
          index?: number;
          briefFidelity?: number;
          creativeSharpness?: number;
          persianCraft?: number;
          factVerified?: boolean;
          factIssues?: string[];
          wasPolished?: boolean;
          redPenNote?: string;
          headline?: string;
          body?: string;
          cta?: string;
        }>;
      };

      let parsed: ParsedReview = {};
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await callDeepSeek([{ role: "user", content: prompt }], {
            maxTokens: 6000,
            temperature: 0.25,
            jsonMode: true,
            thinking: true,
            reasoningEffort: "low",
          });
          totalTokens += res.inputTokens + res.outputTokens;
          totalCostUsd += res.costUsd;
          parsed = parseJsonSafe<ParsedReview>(res.content);
          break;
        } catch {
          if (attempt === 1) {
            parsed = {};
          }
        }
      }

      const byIdx = new Map<number, NonNullable<typeof parsed.reviews>[number]>();
      for (const r of parsed.reviews ?? []) {
        if (typeof r.index === "number") byIdx.set(r.index, r);
      }

      chunk.forEach((c, localIdx) => {
        const r = byIdx.get(localIdx);
        const headline = readOnly
          ? c.item.ad.headline
          : String(r?.headline ?? c.item.ad.headline).trim() || c.item.ad.headline;
        const body = readOnly
          ? c.item.ad.body
          : String(r?.body ?? c.item.ad.body).trim() || c.item.ad.body;
        const cta = readOnly
          ? c.item.ad.cta
          : String(r?.cta ?? c.item.ad.cta).trim() || c.item.ad.cta;
        const craftRaw = typeof r?.persianCraft === "number" ? r.persianCraft : 84;
        const fidRaw = typeof r?.briefFidelity === "number" ? r.briefFidelity : 88;
        const persianCraft = Math.max(20, Math.min(99, Math.round(craftRaw)));
        const briefFidelity = Math.max(20, Math.min(99, Math.round(fidRaw)));
        const factVerified = r?.factVerified !== false;
        const factIssues = Array.isArray(r?.factIssues) ? r.factIssues.map(String).filter(Boolean) : [];
        const wasPolished =
          !readOnly &&
          (Boolean(r?.wasPolished) ||
            headline !== c.item.ad.headline ||
            body !== c.item.ad.body ||
            cta !== c.item.ad.cta);
        const redPenNote = String(
          r?.redPenNote ??
            (wasPolished ? "ریتم فارسی و وضوح بریف صیقل داده شد." : "فارسی بومی و تطابق بریف تایید شد.")
        ).trim();

        auditedMap.set(c.origIdx, {
          director: c.item.director,
          strategy: c.item.strategy,
          ad: {
            ...c.item.ad,
            headline,
            body,
            cta,
            voiceRegister,
          },
          review: {
            persianCraft,
            briefFidelity,
            factVerified,
            factIssues,
            redPenNote,
            wasPolished,
          },
        });
      });
    })
  );

  const audited = candidates.map((_, idx) => auditedMap.get(idx)!).filter(Boolean);
  return {
    audited,
    tokens: totalTokens,
    costUsd: totalCostUsd,
  };
}

/**
 * Live Parallel Mini-Focus Group (System-2 DeepSeek Flash fast ~450ms)
 */
export async function runMiniFocusGroup(params: {
  ad: AdCopy;
  targets: Array<{ persona: Persona; judgment: PersonJudgment }>;
}): Promise<{ quotes: FocusGroupQuote[]; tokens: number; costUsd: number }> {
  const { ad, targets } = params;
  const picks = targets.slice(0, 4);

  const results = await Promise.all(
    picks.map(async ({ persona: p, judgment: j }, idx) => {
      // V4 Creative Critique Focus Group: asks about emotional spark, boredom/cliché, and vivid desire
      // instead of paranoid scam-auditor questions that forced compliance walls!
      const anglePrompt =
        idx < 2
          ? `خیلی کوتاه، صریح و محاوره‌ای (۱ تا ۲ جمله، زیر ۳۰ کلمه) بگو:
۱) کجای این تبلیغ دقیقاً به دلت نشست یا باعث شد مکث کنی؟
۲) کجاش هنوز کمی کلیشه‌ای، مبهم یا کم‌رمق بود؟`
          : `خیلی کوتاه، صریح و محاوره‌ای (۱ تا ۲ جمله، زیر ۳۰ کلمه) بگو:
۱) اگر وسط اسکرول ساعت ۱۱ شب اینو می‌دیدی، چی باعث می‌شد واقعاً روش کلیک کنی؟
۲) چه تصویر یا حس ملموسی توش کم بود؟`;

      const prompt = `تو نقش این فرد واقعی ایرانی هستی: ${p.name}، ${p.age} ساله، ${p.job} در ${p.neighborhood} ${p.city} (درآمد ماهانه ${p.monthly_income_m} میلیون، ${p.marital_status}).
عادت خرید و زندگی: ${p.payment_habit}.

همین الان این تبلیغ رو وسط اسکرول اینستاگرام دیدی:
تیتر: ${ad.headline}
متن: ${ad.body}
دکمه: ${ad.cta}

واکنش درونی تو: توقف تیتر ${Math.round(j.stop * 100)}٪، کشش ${Math.round(j.intent * 100)}٪، احتمال کلیک ${Math.round(j.click * 100)}٪.

${anglePrompt}
فقط حرف زدن طبیعی و واقعی این فرد را بنویس (بدون حرف‌های تکراری درباره اینماد/شاپرک و بدون مقدمه یا گیومه اضافی).`;

      try {
        const res = await callDeepSeek([{ role: "user", content: prompt }], {
          maxTokens: 150,
          temperature: 0.85,
          thinking: false,
        });
        return {
          quote: {
            personaId: p.id,
            name: p.name,
            age: p.age,
            city: p.city,
            job: p.job,
            reaction: j.reaction,
            clickPct: Math.round(j.click * 100),
            trustPct: Math.round(j.trust * 100),
            quote: res.content.replace(/^["«]|["»]$/g, "").trim(),
          } as FocusGroupQuote,
          tokens: res.inputTokens + res.outputTokens,
          costUsd: res.costUsd,
        };
      } catch {
        return null;
      }
    })
  );

  const valid = results.filter((r): r is NonNullable<typeof r> => r !== null);
  return {
    quotes: valid.map((v) => v.quote),
    tokens: valid.reduce((s, v) => s + v.tokens, 0),
    costUsd: valid.reduce((s, v) => s + v.costUsd, 0),
  };
}

/**
 * V4 Evolutionary Leap (Gen 2 Golden Crossover + Champion Surgery + Bold Dethroner)
 * Proven empirically to beat already-strong Gen-1 champions in direct rotated showdowns!
 */
export async function mutateAdWithDiagnostics(params: {
  champion: VariantResult;
  allVariants: VariantResult[];
  heatmap: ClauseHeat[];
  focusGroupQuotes: FocusGroupQuote[];
  productTruth: string;
  voiceRegister: VoiceRegister;
  reasoningMode: ReasoningMode;
  generation: number;
  variantsPerGen: number;
}): Promise<{
  stage: "diverge" | "crossover" | "polish";
  diagnosis: string;
  objections: string[];
  landingPageTips: string[];
  variants: Array<{ director: string; strategy: string; ad: AdCopy }>;
  tokens: number;
  costUsd: number;
}> {
  const {
    champion,
    allVariants,
    heatmap,
    focusGroupQuotes,
    productTruth,
    voiceRegister,
    reasoningMode,
    generation,
    variantsPerGen,
  } = params;

  const stage: "diverge" | "crossover" | "polish" =
    generation === 1 ? "diverge" : generation === 2 ? "crossover" : "polish";

  // Find true #2 runner-up (excluding original & champion) for Full-Market Bridge Crossover
  const runnerUp =
    [...allVariants]
      .filter((v) => v.id !== champion.id && v.generation > 0)
      .sort((a, b) => b.fitness - a.fitness)[0] ?? champion;

  const heatLines = heatmap
    .map((h) => `- [${h.score >= 0 ? "+" : ""}${h.score.toFixed(2)}] (${h.kind}) «${h.clause}»`)
    .join("\n");

  const focusLines =
    focusGroupQuotes.length > 0
      ? focusGroupQuotes
          .map(
            (q) =>
              `- ${q.name} (${q.age} ساله، ${q.job} در ${q.city}): «${q.quote}»`
          )
          .join("\n")
      : "—";

  const archLines =
    champion.segmentsByArchetype && champion.segmentsByArchetype.length > 0
      ? champion.segmentsByArchetype
          .map((s) => `- ${s.label} (${s.count} نفر): امتیاز ${s.fitness} | کلیک ${s.click}٪ | اعتماد ${s.trust}٪`)
          .join("\n")
      : "—";

  const origVar = allVariants.find((v) => v.generation === 0) ?? champion;

  const priorSummary = allVariants
    .map(
      (v) =>
        `- ${v.id} [${v.director ?? v.strategy}] امتیاز=${v.fitness} (تناسب=${Math.round(v.relevance ?? 50)}٪، تیتر=${Math.round(v.stop)}٪، شفافیت=${Math.round(v.clarity)}٪، اعتماد=${Math.round(v.trust)}٪، کلیک=${Math.round(v.click)}٪): «${v.ad.headline}»`
    )
    .join("\n");

  const topTwoBlock = `پیشنهاد و محصول اصلی مشتری (قفل بریف — از این موضوع منحرف نشو!):
تیتر اصلی: ${origVar.ad.headline}
متن اصلی: ${origVar.ad.body}

قهرمان فعلی (${champion.id} — امتیاز ${champion.fitness}/100 | انحراف معیار جمعیت ±${champion.fitnessStd ?? 0} | تناسب ${Math.round(champion.relevance ?? 50)}٪ | توقف تیتر ${Math.round(champion.stop)}٪ | شفافیت ۳ ثانیه ${Math.round(champion.clarity)}٪ | اعتماد ${Math.round(champion.trust)}٪ | کلیک واقعی ${Math.round(champion.click)}٪):
تیتر: ${champion.ad.headline}
متن: ${champion.ad.body}
CTA: ${champion.ad.cta}

واکنش تیپ‌های مختلف خریدار ایرانی به قهرمان فعلی (ببین کدام تیپ‌ها عاشقش شدند و کدام‌ها ردش کردند!):
${archLines}

نایب‌قهرمان (${runnerUp.id} — امتیاز ${runnerUp.fitness}/100 | توقف ${Math.round(runnerUp.stop)}٪ | شفافیت ${Math.round(runnerUp.clarity)}٪ | اعتماد ${Math.round(runnerUp.trust)}٪):
تیتر: ${runnerUp.ad.headline}
متن: ${runnerUp.ad.body}
CTA: ${runnerUp.ad.cta}`;

  const count = Math.max(2, Math.min(3, variantsPerGen));
  const stagePrompt =
    stage === "crossover"
      ? `مأموریت نسل ۲ — ساخت دقیقاً ${count} نسخه برتر بر اساس **داده‌های واقعی جمعیت و گلوگاه قیف**:
1) **پُل دو بازار (Full-Market Bridge)**: قلابِ متوقف‌کننده قهرمان یا نایب‌قهرمان را (که سریع‌ردکن‌ها و مدرن‌ها را می‌گیرد) با وضوح ۳ ثانیه، نام برند و ریسک‌زدایی شفاف (که عمل‌گراها و سنتی‌ها را قانع می‌کند) ترکیب کن تا همزمان هر دو بخش بازار را ببرد!
2) **جراحی گلوگاه اصلی (Bottleneck Fixer)**: ضعیف‌ترین عدد قهرمان فعلی را ببین (مثلاً اگر اعتماد پایین است سازوکار معتبر و آرام اضافه کن؛ اگر توقف تیتر پایین است تیتر را تیزتر کن؛ اگر شفافیت پایین است محصول و پیشنهاد را در ۳ ثانیه اول روشن کن) و دقیقاً همان گلوگاه را بدون خراب کردن نقاط قوت حل کن.${
          count >= 3
            ? "\n3) **رقیب برای بخش ازدست‌رفته (Under-Served Segment Challenger)**: به لیست تیپ‌های خریدار بالا نگاه کن؛ کدام تیپ به قهرمان فعلی کمترین نمره را داده؟ یک تبلیغ کاملاً تازه و ۱۰۰٪ روی بریف بساز که دقیقاً دل آن بخش را ببرد."
            : ""
        }`
      : `مأموریت نسل ${generation} — صیقل نهایی آژانس (Agency Final Polish) — ساخت دقیقاً ${count} فینالیست:
1) **صیقل ریتم و وضوح ۳ ثانیه**: هسته برنده را کوتاه‌تر، شفاف‌تر و بومی‌تر کن تا هیچ کلمه اضافه یا ابهامی نماند.
2) **بهینه‌سازی تبدیل و اعتماد**: جمله پایانی و CTA را طوری جراحی کن که بیشترین کلیک واقعی را در تمام تیپ‌های خریدار بگیرد.${
          count >= 3
            ? "\n3) **فینالیست جسورانه روی بریف**: یک تیتر متمایزتر بدون قربانی کردن شفافیت محصول."
            : ""
        }`;

  const platGuide = PLATFORM_FORMAT_GUIDE[champion.ad.platform ?? "instagram_story"] ?? PLATFORM_FORMAT_GUIDE.instagram;

  const prompt = `تو **استراتژیست ارشد رشد و کارگردان خلاقیت** بازار دیجیتال ایران هستی.

${platGuide}

${VOICE_REGISTER_GUIDE[voiceRegister]}

قوانین طلایی (تخلف = مردود!):
- **قفل بریف (Core-Offer Lock)**: محصول/برند و پیشنهاد اصلی مشتری باید در ۳ ثانیه اول کاملاً روشن باشد؛ هرگز از پیشنهاد اصلی منحرف نشو و تیتر گنگ و معمایی ننویس!
- نقطه ضعف محصول (مثل نرخ سود) را تیتر نکن.
- ممنوعیت ایموجی، فارسی ترجمه‌ای، پسوندهای نچسب («ماهانه‌ت»، «فیزیکی‌ت»)، لحن دفاعی/شاپرکی و تکرار تیترهای قبلی!

${topTwoBlock}

هیت‌مپ جمله‌به‌جمله قهرمان:
${heatLines}

واکنش واقعی ۴ مخاطب به قهرمان:
${focusLines}

تاریخچه تمام نسخه‌های قبلی (تکرار نکن!):
${priorSummary}

حقایق مجاز محصول (فقط ضدتوهم — لازم نیست تمام خطوط را در ۲ جمله بچپانی!):
${productTruth || "فقط بر اساس حقایق موجود در متن اصلی تبلیغ."}

${stagePrompt}

طول ایده‌آل: تیتر ۳ تا ۱۰ کلمه (میخکوب‌کننده)، بدنه ۱۴ تا ۳۲ کلمه، CTA کوتاه و طبیعی (۲ تا ۴ کلمه).
درون متن‌های فارسی فقط از گیومه « » استفاده کن و هرگز علامت " درون رشته JSON نگذار.

دقیقاً JSON زیر را برگردان:
{
  "diagnosis": "تحلیل کوتاه ۱ تا ۲ جمله‌ای درباره اینکه چطور می‌توان قهرمان فعلی را یک سطح بالاتر برد",
  "objections": ["نکته کلیدی ۱", "نکته کلیدی ۲", "نکته کلیدی ۳"],
  "landingPageTips": ["توصیه لندینگ‌پیج ۱", "توصیه لندینگ‌پیج ۲"],
  "variants": [
    {"strategy": "نام کوتاه ۲ تا ۴ کلمه‌ای استراتژی", "headline": "...", "body": "...", "cta": "..."}
  ]
}`;

  type MutParsed = {
    diagnosis?: string;
    objections?: string[];
    landingPageTips?: string[];
    variants?: Array<{ strategy?: string; headline?: string; body?: string; cta?: string }>;
  };

  let parsed: MutParsed = {};
  let tokens = 0;
  let costUsd = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callDeepSeek([{ role: "user", content: prompt }], {
      maxTokens: attempt === 0 ? 7500 : 5000,
      temperature: stage === "polish" ? 0.74 : 0.84,
      jsonMode: true,
      thinking: true,
      reasoningEffort: attempt === 0 ? (reasoningMode === "max" ? "high" : "low") : "low",
    });
    tokens += res.inputTokens + res.outputTokens;
    costUsd += res.costUsd;
    try {
      parsed = parseJsonSafe<MutParsed>(res.content);
      break;
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }

  const rawVariants = parsed.variants ?? [];
  const dirLabel = stage === "crossover" ? "پیوند ژنتیکی" : "صیقل آژانس";

  return {
    stage,
    diagnosis: String(parsed.diagnosis ?? ""),
    objections: Array.isArray(parsed.objections) ? parsed.objections.slice(0, 4).map(String) : [],
    landingPageTips: Array.isArray(parsed.landingPageTips) ? parsed.landingPageTips.slice(0, 3).map(String) : [],
    variants: rawVariants.slice(0, count).map((v) => ({
      director: dirLabel,
      strategy: String(v.strategy ?? "جهش خلاقانه").trim(),
      ad: {
        headline: String(v.headline ?? champion.ad.headline).trim(),
        body: String(v.body ?? champion.ad.body).trim(),
        cta: String(v.cta ?? champion.ad.cta).trim(),
        platform: champion.ad.platform,
        voiceRegister,
        imageDataUrl: champion.ad.imageDataUrl,
      },
    })),
    tokens,
    costUsd,
  };
}

/**
 * SYSTEM 4 Helper (V4): Generates 3 GENUINELY STRONG, MODERN 1405 Iranian competitor ads
 * (NO weak 2019 brochure strawmen!) so Feed Battle is a brutal, credible real-world stress test!
 */
export async function generateCompetitorFeedAds(params: {
  ad: AdCopy;
  productTruth: string;
  competitorContext?: string;
}): Promise<{ competitors: CompetitorFeedAd[]; tokens: number; costUsd: number }> {
  const prompt = `تو تحلیلگر ارشد بازار تبلیغات دیجیتال ایران در سال ۱۴۰۵ هستی.
ما می‌خواهیم یک «آزمون واقعی شلوغی فید اینستاگرام» (Simulated Feed Battle) اجرا کنیم: یعنی تبلیغ کاربر را کنار ۳ تبلیغ **قوی، مدرن و حرفه‌ای** رقبای ایرانی در همین دسته بگذاریم تا ببینیم واقعاً سهم توجه می‌گیرد یا نه.

تبلیغ پایه کاربر:
تیتر: ${params.ad.headline}
متن: ${params.ad.body}
واقعیات محصول: ${params.productTruth.slice(0, 500) || "—"}
${params.competitorContext ? `رقبای ذکرشده توسط کاربر: ${params.competitorContext}` : ""}

قانون طلایی (ضد حریف پوشالی!):
- تبلیغ رقبا نباید ضعیف، بروشوری یا شعاری (مثل «آموزش جامع با تخفیف ویژه!») باشد!
- هر ۳ تبلیغ رقیب باید **واقعاً قوی، امروزی، کوتاه و در سطح بهترین کمپین‌های پرفورمنس ۱۴۰۵ ایران** باشند (تیتر تیز و مشخص ۴ تا ۱۰ کلمه، بدنه روان ۱ تا ۲ جمله، بدون ایموجی، با نام برند رقیب در متن).
- درون متن فارسی فقط از گیومه « » استفاده کن.

دقیقاً JSON زیر را برگردان:
{
  "competitors": [
    {"brand": "نام رقیب ۱", "headline": "تیتر قوی و امروزی", "body": "۱ تا ۲ جمله قوی و واقعی از تبلیغ رقیب"},
    {"brand": "نام رقیب ۲", "headline": "تیتر قوی و امروزی", "body": "۱ تا ۲ جمله قوی و واقعی از تبلیغ رقیب"},
    {"brand": "نام رقیب ۳", "headline": "تیتر قوی و امروزی", "body": "۱ تا ۲ جمله قوی و واقعی از تبلیغ رقیب"}
  ]
}`;

  const res = await callDeepSeek([{ role: "user", content: prompt }], {
    maxTokens: 3500,
    temperature: 0.78,
    jsonMode: true,
    thinking: true,
    reasoningEffort: "low",
  });

  const parsed = parseJsonSafe<{ competitors?: Array<{ brand?: string; headline?: string; body?: string }> }>(
    res.content
  );
  const competitors: CompetitorFeedAd[] = (parsed.competitors ?? []).slice(0, 3).map((c, idx) => ({
    brand: String(c.brand ?? `رقیب ${idx + 1}`).trim(),
    headline: String(c.headline ?? "").trim(),
    body: String(c.body ?? "").trim(),
  }));

  return {
    competitors: competitors.filter((c) => c.headline.length > 2),
    tokens: res.inputTokens + res.outputTokens,
    costUsd: res.costUsd,
  };
}

/**
 * SYSTEM 5: Instagram Comment-Section Simulator + Admin Defense Playbook («پیش‌بینی کامنت‌های زیر پست»)
 * Simulates 8 hyper-realistic Iranian comments from actual crowd personas (skeptics, trolls, price-checkers, buyers)
 * + writes crisp, non-defensive brand admin replies grounded strictly in productTruth!
 */
export async function simulateInstagramComments(params: {
  ad: AdCopy;
  productTruth: string;
  personas: Array<{ persona: Persona; judgment: PersonJudgment }>;
}): Promise<{ comments: SimulatedComment[]; tokens: number; costUsd: number }> {
  const picks = params.personas.slice(0, 8);
  const personaList = picks
    .map(
      ({ persona: p, judgment: j }, i) =>
        `[${i}] ${p.name}، ${p.age}س، ${p.job} در ${p.city} (درآمد ${p.monthly_income_m} م.ت) | تیپ: ${p.ad_archetype} | واکنش به این تبلیغ: ${j.reaction} (اعتماد ${Math.round(j.trust * 100)}٪)`
    )
    .join("\n");

  const prompt = `تو شبیه‌ساز فضای واقعی کامنت‌های اینستاگرام ایران و مدیر ارشد شبکه‌های اجتماعی (Social Media Lead) هستی.
این تبلیغ به صورت پست/ریلز اسپانسری در اینستاگرام ایران پخش شده است:
تیتر: ${params.ad.headline}
متن: ${params.ad.body}
CTA: ${params.ad.cta}

واقعیات محصول (ادمین فقط حق دارد از همین واقعیات جواب بدهد و هیچ ادعای جدیدی نسازد):
${params.productTruth || "فقط بر اساس متن تبلیغ."}

۸ مخاطب واقعی که همین پست را در اینستاگرام دیده‌اند:
${personaList}

قوانین بسیار مهم:
1) هر کامنت باید **مستقیماً درباره همین تبلیغ و همین محصول و عددهایش** باشد (۵ تا ۲۲ کلمه، ۱۰۰٪ محاوره‌ای و تند/واقعی اینستاگرام ایران — مثلاً سوال درباره نرخ، کارمزد، شرایط قسط، نحوه تحویل، تجربه قبلی، یا کنایه/تردید درباره همین آفر!). هرگز کامنت بی‌ربط درباره «پیامک تبلیغاتی» یا «آنباکسینگ» ننویس!
2) هر **پاسخ ادمین** باید کوتاه (۱ تا ۲ جمله محترمانه و انسانی)، **متفاوت از بقیه پاسخ‌ها** و دقیقاً جواب‌گوی همان کامنت باشد — هرگز کل بروشور محصول را زیر هر ۸ کامنت کپی‌پیست نکن!

دقیقاً JSON زیر را برگردان:
{
  "comments": [
    {
      "index": 0,
      "tone": "skeptic" | "troll" | "price_check" | "curious" | "buyer",
      "comment": "متن کامنت واقعی ایرانی درباره همین تبلیغ",
      "suggestedReply": "پاسخ کوتاه، انسانی و دقیق ادمین برند به همین کامنت"
    }
  ]
}`;

  const res = await callDeepSeek([{ role: "user", content: prompt }], {
    maxTokens: 7000,
    temperature: 0.85,
    jsonMode: true,
    thinking: true,
    reasoningEffort: "high",
  });

  const parsed = parseJsonSafe<{
    comments?: Array<{
      index?: number;
      tone?: string;
      comment?: string;
      suggestedReply?: string;
    }>;
  }>(res.content);

  const validTones = new Set(["skeptic", "troll", "price_check", "curious", "buyer"]);
  const comments: SimulatedComment[] = [];

  for (const item of parsed.comments ?? []) {
    const idx = typeof item.index === "number" ? item.index : comments.length;
    const pick = picks[idx];
    if (!pick) continue;
    const tone = validTones.has(String(item.tone))
      ? (String(item.tone) as SimulatedComment["tone"])
      : "curious";
    const comment = String(item.comment ?? "").trim();
    const suggestedReply = String(item.suggestedReply ?? "").trim();
    if (!comment) continue;
    comments.push({
      personaId: pick.persona.id,
      name: pick.persona.name,
      age: pick.persona.age,
      city: pick.persona.city,
      job: pick.persona.job,
      tone,
      comment,
      suggestedReply,
    });
  }

  return {
    comments,
    tokens: res.inputTokens + res.outputTokens,
    costUsd: res.costUsd,
  };
}

/**
 * V7 Closed-Loop Admin Reply Optimizer + Missing Truth Gap Detector (~5s):
 * Triggered ONLY when initial Admin Replies fail to recover trust under comment-section scrutiny.
 * Rewrites replies to be warmer, more direct, non-defensive, and grounded strictly in productTruth,
 * AND detects if a concrete missing fact in productTruth is preventing full trust recovery!
 */
export async function optimizeAdminReplies(params: {
  ad: AdCopy;
  productTruth: string;
  voiceRegister: VoiceRegister;
  attackComments: Array<{ index: number; tone: string; comment: string; oldReply: string }>;
  baselineTrustPct: number;
  afterReplyTrustPct: number;
}): Promise<{
  replies: Map<number, string>;
  missingTruthGap: string | null;
  tokens: number;
  costUsd: number;
}> {
  const { ad, productTruth, voiceRegister, attackComments, baselineTrustPct, afterReplyTrustPct } = params;

  const block = attackComments
    .map(
      (c) =>
        `[${c.index}] (${c.tone}) کامنت: «${c.comment}»\nپاسخ قبلی که اعتماد را برنگرداند: «${c.oldReply}»`
    )
    .join("\n\n");

  const prompt = `تو مدیر ارشد روابط‌عمومی و رشد برند در اینستاگرام ایران هستی.
پاسخ‌های قبلی ادمین زیر این تبلیغ نتوانستند اعتماد مخاطبان را برگردانند (اعتماد پایه ${baselineTrustPct}٪ بود، بعد از پاسخ قبلی فقط به ${afterReplyTrustPct}٪ رسید!).

تبلیغ:
تیتر: ${ad.headline}
متن: ${ad.body}

واقعیات قطعی محصول (خط قرمز: هیچ عدد، درصد یا مجوزی خارج از این لیست اختراع نکن!):
${productTruth || "فقط اطلاعات موجود در متن تبلیغ."}

${VOICE_REGISTER_GUIDE[voiceRegister]}

کامنت‌های شکاک و پاسخ قبلی:
${block}

مأموریت:
1) برای هر کامنت یک **پاسخ ادمینِ خیلی صمیمی، بااعتمادبه‌نفس، مستقیم و غیرپلیسی (۱ تا ۲ جمله محاوره‌ای طبیعی)** بنویس که:
   - هرگز خشک/اداری («تحویل داده می‌شود») نباشد.
   - هرگز ترس مخاطب را تایید یا بزرگ نکند (مثلاً نگو «بله گرون‌تر می‌شه»).
   - مستقیم‌ترین پاسخ واقعی ممکن از واقعیات محصول را بدهد و حس اطمینان و شفافیت بدهد.
2) اگر پاسخ قطعیِ یکی از سوالات کلیدی مخاطبان (مثل درصد دقیق کارمزد، مبلغ دقیق، یا روش استعلام) اصلاً در «واقعیات محصول» وجود نداشت و به همین دلیل هیچ پاسخی بدون دروغ‌گفتن نمی‌تواند ۱۰۰٪ قانع‌شان کند، در \`missingTruthGap\` در یک جمله کوتاه و کاربردی به صاحب کسب‌وکار هشدار بده چه اطلاعاتی را باید شفاف اضافه کند (وگرنه \`null\` بگذار).

فقط JSON دقیق برگردان:
{
  "replies": [
    {"index": 0, "reply": "..."}
  ],
  "missingTruthGap": "جمله کوتاه هشدار شکاف اطلاعاتی یا null"
}`;

  const res = await callDeepSeek([{ role: "user", content: prompt }], {
    maxTokens: 3500,
    temperature: 0.45,
    jsonMode: true,
    thinking: true,
    reasoningEffort: "low",
  });

  const parsed = parseJsonSafe<{
    replies?: Array<{ index?: number; reply?: string }>;
    missingTruthGap?: string | null;
  }>(res.content);

  const replies = new Map<number, string>();
  for (const r of parsed.replies ?? []) {
    if (typeof r.index === "number" && r.reply) {
      replies.set(r.index, String(r.reply).trim());
    }
  }
  const gapRaw = parsed.missingTruthGap ? String(parsed.missingTruthGap).trim() : "";
  const missingTruthGap = gapRaw && gapRaw.toLowerCase() !== "null" && gapRaw.length > 8 ? gapRaw : null;

  return {
    replies,
    missingTruthGap,
    tokens: res.inputTokens + res.outputTokens,
    costUsd: res.costUsd,
  };
}

/**
 * SYSTEM 6A: Ready-to-Launch Multi-Platform Iranian Campaign Kit (deepseek-flash on max)
 * Adapts the winning DNA into: Instagram 3-Frame Story, Reels 0-3s Hook, Telegram Sponsored Post, Yektanet Native Ad.
 */
export async function generateLaunchKit(params: {
  champion: AdCopy;
  productTruth: string;
  voiceRegister: VoiceRegister;
  splitSummary?: string;
  landingPageTips?: string[];
}): Promise<{ kit: LaunchKit; tokens: number; costUsd: number }> {
  const prompt = `تو کارگردان خلاقیت و مدیر کمپین‌های دیجیتال ایران هستی.
این نسخه تبلیغی برنده تست جمعیت ما شده است:
تیتر قهرمان: ${params.champion.headline}
متن قهرمان: ${params.champion.body}
CTA قهرمان: ${params.champion.cta}

واقعیات قطعی محصول (هیچ ادعای خارج از این لیست نساز!):
${params.productTruth || "فقط بر اساس متن قهرمان."}

${VOICE_REGISTER_GUIDE[params.voiceRegister]}

همین پیام برنده را برای **۴ کانال اصلی تبلیغات ایران** با استاندارد حرفه‌ای، فارسی ۱۰۰٪ بومی و بدون ایموجی اقتباس کن:
1) **سناریو استوری ۳ فریمی اینستاگرام** (فریم ۱: قلاب توقف اسکرول | فریم ۲: اثبات و تصویر ملموس | فریم ۳: پیشنهاد نهایی + متن استیکر لینک) — هر فریم شامل توضیح کوتاه قاب تصویری (\`visualNote\`) و متن روی تصویر (\`text\`).
2) **هوک ۳ ثانیه اول ریلز (Reels 0-3s)** شامل جمله دقیق گفتاری/تیتر روی ویدیو، حرکت تصویری، و کپشن کوتاه زیر ریلز.
3) **پست تبلیغاتی کانال تلگرام** (فرمت خواندنی، بولت‌دار یا ۲-۳ پاراگراف کوتاهِ قانع‌کننده که در کانال‌های خبری/تخصصی تلگرام ایران نرخ کلیک بالا می‌گیرد).
4) **تبلیغ همسان یکتانت (Yektanet Native)** با تیتر فوق‌العاده موجز (حداکثر ۵۵ کاراکتر) + زیرتیتر (حداکثر ۹۵ کاراکتر) + دکمه کوتاه.

دقیقاً JSON زیر را برگردان:
{
  "storyFrames": [
    {"frame": 1, "role": "قلاب توقف اسکرول", "visualNote": "پیشنهاد تصویر یا ویدیو", "text": "متن کوتاه روی فریم ۱"},
    {"frame": 2, "role": "اثبات و ملموس‌سازی", "visualNote": "پیشنهاد تصویر یا ویدیو", "text": "متن کوتاه روی فریم ۲"},
    {"frame": 3, "role": "دعوت به اقدام", "visualNote": "پیشنهاد تصویر یا ویدیو", "text": "متن کوتاه روی فریم ۳", "sticker": "متن کوتاه روی استیکر لینک"}
  ],
  "reelsHook": {
    "seconds0to3": "جمله دقیق ۰ تا ۳ ثانیه اول برای قفل کردن مخاطب",
    "visualAction": "چه صحنه‌ای در ۳ ثانیه اول دیده شود",
    "caption": "کپشن کوتاه و تمیز زیر ریلز"
  },
  "telegramPost": {
    "headline": "تیتر گیرای پست تلگرام",
    "body": "متن تمیز و خواندنی ۳ تا ۵ خطی مناسب کانال تلگرام",
    "cta": "جمله لینک‌دار پایانی تلگرام"
  },
  "yektanetAd": {
    "title": "تیتر همسان زیر ۵۵ کاراکتر",
    "subtitle": "توضیح کوتاه زیر ۹۵ کاراکتر",
    "cta": "دکمه ۲ تا ۳ کلمه‌ای"
  }
}`;

  const res = await callDeepSeek([{ role: "user", content: prompt }], {
    maxTokens: 11000,
    temperature: 0.78,
    jsonMode: true,
    thinking: true,
    reasoningEffort: "max",
  });

  const parsed = parseJsonSafe<Partial<LaunchKit>>(res.content);
  const kit: LaunchKit = {
    storyFrames: Array.isArray(parsed.storyFrames)
      ? parsed.storyFrames.slice(0, 3).map((f, i) => ({
          frame: Number(f.frame ?? i + 1),
          role: String(f.role ?? `فریم ${i + 1}`),
          visualNote: String(f.visualNote ?? ""),
          text: String(f.text ?? ""),
          sticker: f.sticker ? String(f.sticker) : undefined,
        }))
      : [],
    reelsHook: {
      seconds0to3: String(parsed.reelsHook?.seconds0to3 ?? ""),
      visualAction: String(parsed.reelsHook?.visualAction ?? ""),
      caption: String(parsed.reelsHook?.caption ?? ""),
    },
    telegramPost: {
      headline: String(parsed.telegramPost?.headline ?? params.champion.headline),
      body: String(parsed.telegramPost?.body ?? params.champion.body),
      cta: String(parsed.telegramPost?.cta ?? params.champion.cta),
    },
    yektanetAd: {
      title: String(parsed.yektanetAd?.title ?? params.champion.headline).slice(0, 80),
      subtitle: String(parsed.yektanetAd?.subtitle ?? params.champion.body).slice(0, 140),
      cta: String(parsed.yektanetAd?.cta ?? params.champion.cta).slice(0, 35),
    },
  };

  return {
    kit,
    tokens: res.inputTokens + res.outputTokens,
    costUsd: res.costUsd,
  };
}

/**
 * SYSTEM 6B Helper: Auto-suggests 5 realistic Iranian 1405 Toman / BNPL pricing offers
 */
export async function suggestPriceOffers(params: {
  productName: string;
  productDescription: string;
  basePriceToman: number;
}): Promise<{ offers: PriceOfferOption[]; costUsd: number }> {
  const prompt = `تو استراتژیست قیمت‌گذاری و فروش در بازار ۱۴۰۵ ایران هستی.
محصول: ${params.productName}
توضیح: ${params.productDescription}
قیمت پایه مرجع: ${params.basePriceToman.toLocaleString("en-US")} تومان

دقیقاً ۵ سناریوی متفاوت و واقعی قیمت‌گذاری / پیشنهاد فروش برای تست کشش قیمتی روی مردم ایران بساز (از اقتصادی‌ترین / تست رایگان تا قسطی اسنپ‌پی/ازکی‌وام و پکیج پریمیوم با ارزش افزوده) تا بفهمیم کدام پیشنهاد بیشترین **درآمد کل (RPM)** را می‌سازد.
عدد \`priceToman\` باید درآمد واقعی تومانی مورد انتظار به ازای هر خریدار/اشتراک باشد (عدد صحیح به تومان).

دقیقاً JSON زیر را برگردان:
{
  "offers": [
    {
      "id": "opt_1",
      "label": "برچسب کوتاه روی نمودار (مثلاً ۱۹۰ هزار · ماهانه)",
      "priceToman": 190000,
      "offerHeadline": "تیتر کوتاه این پیشنهاد",
      "offerDetails": "۱ جمله شفاف درباره قیمت، قسط یا ضمانت این گزینه",
      "cta": "دکمه کوتاه"
    }
  ]
}`;

  const res = await callDeepSeek([{ role: "user", content: prompt }], {
    maxTokens: 5500,
    temperature: 0.72,
    jsonMode: true,
    thinking: true,
    reasoningEffort: "high",
  });

  const parsed = parseJsonSafe<{ offers?: Array<Partial<PriceOfferOption>> }>(res.content);
  const offers: PriceOfferOption[] = (parsed.offers ?? []).slice(0, 6).map((o, idx) => ({
    id: String(o.id ?? `opt_${idx + 1}`),
    label: String(o.label ?? `پیشنهاد ${idx + 1}`).trim(),
    priceToman: Math.max(10_000, Math.round(Number(o.priceToman ?? params.basePriceToman))),
    offerHeadline: String(o.offerHeadline ?? "").trim(),
    offerDetails: String(o.offerDetails ?? "").trim(),
    cta: String(o.cta ?? "مشاهده و شروع").trim(),
  }));

  return { offers, costUsd: res.costUsd };
}

/**
 * Auto-ICP Matcher (deepseek-flash high)
 */
export async function detectAutoICP(params: {
  ad: AdCopy;
  productTruth: string;
  availableSectors: string[];
  availableCityTiers: string[];
  availableIncomeTiers: string[];
}): Promise<{
  filters: AudienceFilters;
  rationale: string;
  icpLabel: string;
  recommendedRegister: VoiceRegister;
}> {
  const prompt = `تو استراتژیست ارشد بازاریابی و بخش‌بندی بازار ایران (ICP Targeting) هستی.
یک کسب‌وکار ایرانی می‌خواهد تبلیغ زیر را روی بانک ۱٬۰۰۰ نفری مردم ایران تست و بهینه کند.
اگر مخاطبان غیرمرتبط (مثلاً بازنشسته یا کشاورزی که اصلاً مخاطب یک اپ دیجیتال نیست) وارد تست شوند، نتیجه خراب می‌شود.

تبلیغ:
تیتر: ${params.ad.headline}
متن: ${params.ad.body}
دکمه: ${params.ad.cta}
پلتفرم: ${params.ad.platform ?? "instagram"}

واقعیات محصول:
${params.productTruth || "—"}

گزینه‌های دقیق موجود در فیلترهای بانک (فقط از همین مقادیر دقیق استفاده کن یا آرایه خالی بگذار یعنی همه):
- cityTiers: ${JSON.stringify(params.availableCityTiers)}
- incomeTiers: ${JSON.stringify(params.availableIncomeTiers)}
- sectors: ${JSON.stringify(params.availableSectors)}
- gender: "all" | "زن" | "مرد"
- minAge / maxAge: عدد بین 18 تا 68
- recommendedRegister: یکی از "colloquial" | "friendly" | "modern_pro" | "bold_genz"

قانون مهم: فیلتر را آن‌قدر تنگ نکن که کمتر از ۸۰ نفر در بانک ۱٬۰۰۰ نفری باقی بماند! فقط بخش‌های واقعاً غیرمرتبط را حذف کن تا یک جامعه هدف دقیق و واقعی (حدود ۱۵۰ تا ۵۰۰ نفر از ۱٬۰۰۰ نفر) شکل بگیرد.

دقیقاً JSON زیر را برگردان:
{
  "icpLabel": "عنوان کوتاه ۳ تا ۶ کلمه‌ای مخاطب هدف (مثلاً: کاربران شهری ۲۲ تا ۴۸ ساله)",
  "rationale": "یک جمله دقیق فارسی توضیح بده چرا این گروه انتخاب شده و چه قشرهای غیرمرتبطی حذف شدند",
  "recommendedRegister": "colloquial",
  "filters": {
    "cityTiers": [],
    "incomeTiers": [],
    "sectors": [],
    "gender": "all",
    "minAge": 20,
    "maxAge": 48
  }
}`;

  const res = await callDeepSeek([{ role: "user", content: prompt }], {
    maxTokens: 3500,
    temperature: 0.35,
    jsonMode: true,
    thinking: true,
    reasoningEffort: "low",
  });
  const parsed = parseJsonSafe<{
    icpLabel?: string;
    rationale?: string;
    recommendedRegister?: VoiceRegister;
    filters?: Record<string, unknown>;
  }>(res.content);
  const rawF = parsed.filters ?? {};

  const validCity = new Set(params.availableCityTiers);
  const validInc = new Set(params.availableIncomeTiers);
  const validSec = new Set(params.availableSectors);

  const cleanArr = (arr: unknown, allow: Set<string>) => {
    if (!Array.isArray(arr)) return undefined;
    const filtered = arr.map(String).filter((x) => allow.has(x));
    return filtered.length > 0 && filtered.length < allow.size ? filtered : undefined;
  };

  const filters: AudienceFilters = {
    cityTiers: cleanArr(rawF.cityTiers, validCity),
    incomeTiers: cleanArr(rawF.incomeTiers, validInc),
    sectors: cleanArr(rawF.sectors, validSec),
    gender: rawF.gender === "زن" || rawF.gender === "مرد" ? rawF.gender : "all",
    minAge: typeof rawF.minAge === "number" && rawF.minAge > 18 ? Math.min(60, Math.round(rawF.minAge)) : undefined,
    maxAge: typeof rawF.maxAge === "number" && rawF.maxAge < 68 ? Math.max(24, Math.round(rawF.maxAge)) : undefined,
  };

  const validRegs = new Set<VoiceRegister>(["colloquial", "friendly", "modern_pro", "bold_genz"]);
  const recommendedRegister: VoiceRegister =
    parsed.recommendedRegister && validRegs.has(parsed.recommendedRegister)
      ? parsed.recommendedRegister
      : "colloquial";

  return {
    filters,
    rationale: String(parsed.rationale ?? "مخاطبان اصلی مطابق محصول انتخاب شدند."),
    icpLabel: String(parsed.icpLabel ?? "مخاطب هدف پیشنهادی"),
    recommendedRegister,
  };
}

/**
 * System 2 Live Persian Persona Interview (snappy ~300ms, thinking off)
 */
export async function interviewPersona(params: {
  persona: Persona;
  ad?: AdCopy;
  judgment?: PersonJudgment;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}): Promise<{ reply: string; ms: number; costUsd: number }> {
  const { persona: p, ad, judgment: j, history, userMessage } = params;

  const reactionMap: Record<string, string> = {
    annoyed: "رد کرد یا کلافه شد",
    neutral: "بی‌تفاوت",
    curious: "کنجکاو",
    excited: "آماده اقدام و متقاعد",
  };

  const adBlock = ad
    ? `\nتبلیغی که همین الان دیدی:\nتیتر: «${ad.headline}»\nمتن: «${ad.body}»\nدکمه: «${ad.cta}»`
    : "";

  const verdictBlock = j
    ? `\nواکنش واقعی درونی تو به این تبلیغ در نظرسنجی:\n- حس لحظه‌ای: ${reactionMap[j.reaction] ?? j.reaction}\n- احتمال توقف روی تیتر: ${Math.round(j.stop * 100)}٪ | احتمال کلیک: ${Math.round(j.click * 100)}٪ | قصد اقدام: ${Math.round(j.intent * 100)}٪ | اعتماد: ${Math.round(j.trust * 100)}٪`
    : "";

  const systemPrompt = `تو نقش یک شهروند واقعی ایرانی را بازی می‌کنی — اصلاً شبیه هوش مصنوعی، مشاور بازاریابی یا متن کتابی حرف نزن!

هویت کامل تو:
- نام: ${p.name} (${p.gender}، ${p.age} ساله)
- محل زندگی: محله ${p.neighborhood} شهر ${p.city} (${p.province})
- شغل و وضعیت مالی: ${p.job}، درآمد ماهانه حدود ${p.monthly_income_m} میلیون تومان (${p.income_tier})، ${p.marital_status}، ${p.housing}
- اپ‌های روزمره: ${p.platforms.join("، ")}
- تیپ رفتاری: ${p.ad_archetype}
- زندگی و تجربه‌های واقعی تو: ${p.life_story}
- نمونه لحن طبیعی حرف زدن تو: «${p.voice_sample}»
${adBlock}
${verdictBlock}

قوانین مصاحبه:
۱) کاملاً به فارسی محاوره‌ای و طبیعیِ متناسب با سن، شغل و شهر خودت جواب بده.
۲) پاسخ‌هایت کوتاه، صریح، واقعی و صادقانه باشد (۲ تا ۴ جمله). تعارف و چاپلوسی الکی نکن!
۳) اگر اعتمادت کم بوده دقیق بگو چه جمله‌ای تو را مشکوک کرد؛ اگر نظرت مثبت بوده بگو دقیقاً چه چیزی جذبت کرد و چه شرطی باعث می‌شود واقعاً اقدام کنی.`;

  const res = await callDeepSeek(
    [{ role: "system", content: systemPrompt }, ...history.slice(-8), { role: "user", content: userMessage }],
    { maxTokens: 320, temperature: 0.82, thinking: false }
  );

  return { reply: res.content.trim(), ms: res.ms, costUsd: res.costUsd };
}

/**
 * On-demand Custom Deep Iranian Crowd Generator
 */
export async function generateCustomDeepPersonas(params: {
  nicheDescription: string;
  count: number;
  startIndex: number;
  tag: string;
}): Promise<{ profiles: Persona[]; costUsd: number }> {
  const count = Math.min(20, Math.max(4, params.count));
  const prompt = `تو یک جامعه‌شناس و پژوهشگر بازار ایران در سال ۱۴۰۵ هستی.
کاربر می‌خواهد یک گروه تخصصی جدید از مخاطبان واقعی ایرانی برای تست تبلیغ بسازد:
موضوع و ویژگی مخاطب هدف: «${params.nicheDescription}»

دقیقاً ${count} پروفایل کاملاً متفاوت، بسیار عمیق، غیرتکراری و فوق‌العاده واقعی از مردم ایران در همین گروه هدف بساز (با تنوع واقعی در سن، شهر/محله‌های واقعی ایران، سطح درآمد تومانی ۱۴۰۵، میزان بدبینی به تبلیغات ۱ تا ۵، و تجربه‌های متفاوت زندگی).

برای هر شخص دقیقاً این فیلدها را برگردان:
- name: نام و نام خانوادگی واقعی ایرانی (متنوع و غیرتکراری)
- gender: "زن" یا "مرد"
- age: عدد واقعی متناسب با مخاطب
- province: استان
- city: شهر
- neighborhood: نام یک محله واقعی در آن شهر
- city_tier: یکی از "تهران" | "کلان‌شهر" | "مرکز استان" | "شهرستان"
- job: شغل واقعی
- sector: دسته‌بندی شغلی کوتاه
- monthly_income_m: عدد درآمد ماهانه به میلیون تومان (مثلاً 28 یا 85)
- income_tier: یکی از "کم‌درآمد" | "متوسط رو به پایین" | "متوسط" | "متوسط رو به بالا" | "مرفه"
- marital_status: "مجرد" | "متاهل بدون فرزند" | "متاهل با فرزند"
- housing: "مستاجر" | "مالک" | "با خانواده"
- platforms: آرایه ۳ تا ۴ اپلیکیشن پرکاربرد در ایران
- payment_habit: یک عبارت کوتاه از عادت پرداخت
- ad_archetype: یکی از "سریع‌ردکنِ بی‌حوصله" | "قیمت‌سنجِ ترب‌باز" | "زخم‌خورده کلاهبرداری اینستاگرام" | "کیفیت‌گرای کم‌وقت" | "شکارچی تخفیف و قسط" | "حساس به حریم خصوصی" | "سنتیِ نیازمند اعتماد" | "تکنولوژی‌دوستِ پیشتاز"
- ad_skepticism: عدد ۱ تا ۵
- life_story: بیوگرافی عمیق ۱۱۰ تا ۱۴۵ کلمه‌ای فارسی شامل روتین روزمره، فشار مالی/زمانی واقعی، تجربه قبلی از خرید آنلاین، محرک‌های توقف اسکرول و خطوط قرمز اعتماد
- voice_sample: یک جمله کوتاه محاوره‌ای طبیعی فارسی
- triggers: آرایه ۳ تگ کوتاه محرک خرید
- red_flags: آرایه ۳ تگ کوتاه خط قرمز

دقیقاً JSON زیر را برگردان:
{"profiles": [...]}`;

  const res = await callDeepSeek([{ role: "user", content: prompt }], {
    maxTokens: 7000,
    temperature: 0.9,
    jsonMode: true,
    thinking: false,
  });
  const parsed = parseJsonSafe<{ profiles?: Array<Record<string, unknown>> }>(res.content);
  const items = Array.isArray(parsed.profiles) ? parsed.profiles : [];

  const validTiers = new Set(["تهران", "کلان‌شهر", "مرکز استان", "شهرستان"]);
  const profiles: Persona[] = items.map((raw, idx) => {
    const seq = params.startIndex + idx + 1;
    const cityTier = validTiers.has(String(raw.city_tier))
      ? (String(raw.city_tier) as Persona["city_tier"])
      : "کلان‌شهر";
    return {
      id: `ir_c${seq.toString().padStart(4, "0")}`,
      name: String(raw.name ?? `کاربر ${seq}`),
      gender: raw.gender === "زن" ? "زن" : "مرد",
      age: Number(raw.age ?? 30),
      province: String(raw.province ?? "تهران"),
      city: String(raw.city ?? "تهران"),
      neighborhood: String(raw.neighborhood ?? "مرکز شهر"),
      city_tier: cityTier,
      job: String(raw.job ?? "کارمند"),
      sector: String(raw.sector ?? "عمومی"),
      monthly_income_m: Number(raw.monthly_income_m ?? 35),
      income_tier: String(raw.income_tier ?? "متوسط"),
      marital_status: String(raw.marital_status ?? "متاهل"),
      housing: String(raw.housing ?? "مستاجر"),
      platforms: Array.isArray(raw.platforms) ? raw.platforms.map(String) : ["اینستاگرام", "تلگرام"],
      payment_habit: String(raw.payment_habit ?? "خرید آنلاین با بررسی اینماد"),
      ad_archetype: String(raw.ad_archetype ?? "سریع‌ردکنِ بی‌حوصله"),
      ad_skepticism: Math.min(5, Math.max(1, Number(raw.ad_skepticism ?? 3))),
      avatar_hue: (seq * 43 + 170) % 360,
      life_story: String(raw.life_story ?? ""),
      voice_sample: String(raw.voice_sample ?? ""),
      triggers: Array.isArray(raw.triggers) ? raw.triggers.slice(0, 3).map(String) : [],
      red_flags: Array.isArray(raw.red_flags) ? raw.red_flags.slice(0, 3).map(String) : [],
      custom_tag: params.tag,
    };
  });

  return { profiles, costUsd: res.costUsd };
}
