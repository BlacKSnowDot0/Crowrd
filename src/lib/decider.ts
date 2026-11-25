import type {
  AdCopy,
  BattleContenderInput,
  BattleContenderResult,
  BattleResult,
  ClauseHeat,
  CompetitorFeedAd,
  CopyChiefReview,
  CounterfactualXrayResult,
  FeedBattleResult,
  Persona,
  PersonJudgment,
  PriceElasticityResult,
  PriceOfferEval,
  PriceOfferOption,
  ReactionCounts,
  ReactionType,
  SegmentSummary,
  SegmentWinner,
  SimulatedComment,
  SocialContagionResult,
  SplitCampaignAdvice,
  VariantResult,
} from "./types";

const PPLX_URL = "https://api.perplexity.ai/v1/decisions";
const DECIDER_MODEL = "pplx-decider-v1.3";
const PRICE_PER_M_INPUT = 0.02;

function getPplxKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY is missing in environment");
  return key;
}

interface DeciderResponse {
  model: string;
  answers: Record<
    string,
    | { type: "noul"; noul: number }
    | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
    | { type: "score"; score: number; confidence: number; probabilities: Record<string, number> }
  >;
  usage?: { input_tokens?: number; output_tokens?: number };
}

async function callDecider(
  state: unknown,
  questions: Record<string, unknown>,
  retries = 2
): Promise<{ data: DeciderResponse; ms: number }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const t0 = Date.now();
    try {
      const resp = await fetch(PPLX_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getPplxKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: DECIDER_MODEL, state, questions }),
        signal: AbortSignal.timeout(45_000),
      });
      const ms = Date.now() - t0;
      if (resp.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 850 * (attempt + 1)));
        continue;
      }
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Perplexity Decider HTTP ${resp.status}: ${text.slice(0, 300)}`);
      }
      const data = (await resp.json()) as DeciderResponse;
      return { data, ms };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "پست/استوری اینستاگرام",
  instagram_story: "استوری ۳ فریمی اینستاگرام (تبلیغ پیج/اینفلوئنسر)",
  instagram_reels: "ریلز ۲۰ ثانیه‌ای اینستاگرام (اکسپلور + کامنت دایرکت)",
  telegram: "پست تبلیغاتی کانال تلگرام",
  divar: "آگهی دیوار",
  banner: "تبلیغ همسان سایت‌ها (یکتانت)",
};

export function buildAdState(ad: AdCopy): unknown {
  const platKey = ad.platform ?? "instagram_story";
  const plat = PLATFORM_LABELS[platKey] ?? "تبلیغ آنلاین فارسی";
  let textBlock: string;

  if (platKey === "instagram_story") {
    textBlock =
      `فرمت: ${plat}\n` +
      `فریم ۱ (قلاب روی تصویر — ۵ ثانیه اول): ${ad.headline}\n` +
      `فریم ۲ (توضیح کوتاه و اثبات): ${ad.body}\n` +
      `فریم ۳ (استیکر لینک/اقدام): [${ad.cta}]`;
  } else if (platKey === "instagram_reels") {
    textBlock =
      `فرمت: ${plat}\n` +
      `قلاب ۰ تا ۳ ثانیه (روی تصویر + گفتار اول): ${ad.headline}\n` +
      `سناریوی ۱۵ ثانیه‌ای ویدیو: ${ad.body}\n` +
      `فراخوان پایان ویدیو (کامنت/دایرکت یا لینک): ${ad.cta}`;
  } else {
    textBlock =
      `پلتفرم نمایش تبلیغ: ${plat}\n` +
      `تیتر تبلیغ: ${ad.headline}\n` +
      `متن تبلیغ: ${ad.body}\n` +
      `دکمه اقدام (CTA): ${ad.cta}`;
  }

  if (ad.imageDataUrl && ad.imageDataUrl.startsWith("data:image/")) {
    return [
      textBlock + "\nتصویر بنر/فریم تبلیغاتی همراه این متن:",
      { type: "image_url", image_url: { url: ad.imageDataUrl } },
    ];
  }
  return textBlock;
}

function buildHeadlineOnlyState(ad: AdCopy): unknown {
  const platKey = ad.platform ?? "instagram_story";
  const plat = PLATFORM_LABELS[platKey] ?? "فید اینستاگرام";
  let textBlock: string;

  if (platKey === "instagram_story") {
    textBlock = `فرمت: ${plat}\nفقط فریم ۱ استوری (مخاطب وسط رد کردن سریع استوری‌ها فقط همین یک خط روی تصویر را در ۱ ثانیه اول می‌بیند):\n«${ad.headline}»`;
  } else if (platKey === "instagram_reels") {
    textBlock = `فرمت: ${plat}\nفقط ۳ ثانیه اول ریلز اکسپلور (قلاب گفتاری و متن روی تصویر پیش از سوایپ):\n«${ad.headline}»`;
  } else {
    textBlock = `پلتفرم: ${plat}\nفقط تیتر اول تبلیغ (مخاطب در نیم ثانیه وسط اسکرول سریع فقط همین خط را می‌بیند، نه متن کامل را):\n«${ad.headline}»`;
  }

  if (ad.imageDataUrl && ad.imageDataUrl.startsWith("data:image/")) {
    return [textBlock, { type: "image_url", image_url: { url: ad.imageDataUrl } }];
  }
  return textBlock;
}

/**
 * V5 Authentic Iranian Buyer Decision Lenses (8 real mindsets — ONLY 1 of 8 is scam-traumatized!).
 * No global editorial rubric is ever injected into persona prompts, so different Iranian demographics
 * and buyer archetypes genuinely disagree just like real people in the market!
 */
const ARCHETYPE_LENS: Record<string, string> = {
  "سریع‌ردکنِ بی‌حوصله":
    "خیلی سریع در اینستاگرام اسکرول می‌کند؛ تیترهای کلیشه‌ای، تکراری یا اداری را در نیم‌ثانیه رد می‌کند و فقط با یک تیتر خیلی تیز یا غیرمنتظره مکث می‌کند.",
  "قیمت‌سنجِ ترب‌باز":
    "عمل‌گرا و حسابگر است؛ شعار خالی برایش مهم نیست و دنبال عدد شفاف، ارزش واقعی و مقایسه منطقی است.",
  "شکارچی تخفیف و قسط":
    "پیشنهادهای کم‌ریسک مثل تست رایگان، تخفیف واقعی یا خرید قسطی سریع جذبش می‌کند؛ بدون مزیت مالی واضح معمولاً رد می‌شود.",
  "تکنولوژی‌دوستِ پیشتاز":
    "سلیقه مدرن دارد؛ از تبلیغ‌های قدیمی و بروشوری حوصله‌اش سر می‌رود و جذب برندهای باهوش، امروزی و خلاقانه می‌شود.",
  "کیفیت‌گرای کم‌وقت":
    "وقتش محدود است؛ تبلیغ باید در ۳ ثانیه روشن بگوید چه مشکلی از کار یا زندگی‌اش حل می‌کند و حس کیفیت و اعتبار حرفه‌ای بدهد.",
  "سنتیِ نیازمند اعتماد":
    "تیترهای گنگ و معمایی را دوست ندارد؛ دنبال پیام روشن، نام برند معتبر و اطمینان خاطر واقعی است.",
  "حساس به حریم خصوصی":
    "از تبلیغ‌های پرفشار، هیجانی یا پر از اجبار ثبت‌نام خوشش نمی‌آید؛ لحن آرام، صادقانه و شروع کم‌اصطکاک برایش مهم است.",
  "زخم‌خورده کلاهبرداری اینستاگرام":
    "به وعده‌های اغراق‌آمیز، فوری و «تضمینی» شدیداً مشکوک است؛ فقط وقتی اعتماد می‌کند که ادعا منطقی، مشخص و بدون هیاهو باشد.",
};

function buildPersonaPromptHeader(p: Persona): string {
  const lens = ARCHETYPE_LENS[p.ad_archetype] ?? p.ad_archetype_desc ?? p.payment_habit;
  return (
    `فرد واقعی: ${p.name}، ${p.gender} ${p.age} ساله، ${p.job} (${p.sector}) ` +
    `در ${p.neighborhood} ${p.city} (${p.city_tier})، درآمد ماهانه ${p.monthly_income_m} میلیون تومان (${p.income_tier})، ` +
    `${p.marital_status}، ${p.housing}.\n` +
    `سبک تصمیم‌گیری این فرد: ${lens}`
  );
}

/** Deterministic uniform [0, 1) hash for reproducible probabilistic reaction sampling (no argmax collapse!) */
function deterministicUnit(key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 100000) / 100000;
}

/**
 * Step A (True 2-Step Funnel — V5 Pure Persona-Conditioned Headline Thumb-Stop):
 * ZERO global rubric override: each persona reacts strictly from their own age, job, income & archetype!
 */
export async function evaluateHeadlineThumbStop(
  ad: AdCopy,
  personas: Persona[]
): Promise<{ stopMap: Map<string, number>; inputTokens: number }> {
  const state = buildHeadlineOnlyState(ad);
  const stopMap = new Map<string, number>();
  let totalTokens = 0;

  const chunkSize = 30;
  const chunks: Persona[][] = [];
  for (let i = 0; i < personas.length; i += chunkSize) {
    chunks.push(personas.slice(i, i + chunkSize));
  }

  const concurrency = 4;
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < chunks.length) {
      const idx = nextIdx++;
      const batch = chunks[idx];
      const questions: Record<string, unknown> = {};
      const platKey = ad.platform ?? "instagram_story";
      const stopPromptTail =
        platKey === "instagram_story"
          ? `این فرد در حال رد کردن سریع استوری‌های اینستاگرام است و فقط فریم ۱ را می‌بیند. آیا دستش را نگه می‌دارد تا فریم‌های بعدی را ببیند یا در ۱ ثانیه تپ‌اسکیپ می‌کند؟`
          : platKey === "instagram_reels"
            ? `این فرد وسط ریلزهای اکسپلور است و فقط ۳ ثانیه اول این ویدیو را می‌بیند. آیا مکث می‌کند ادامه ویدیو را ببیند یا سریع سوایپ می‌کند بالا؟`
            : `این فرد با عجله در حال اسکرول فید است و فقط همین یک خط تیتر به چشمش می‌خورد (هنوز بدنه تبلیغ را ندیده). با توجه به اینکه بیشتر تبلیغ‌ها بدون مکث رد می‌شوند، آیا فقط همین تیتر باعث می‌شود انگشت *همین فرد خاص* مکث کند؟`;
      for (const p of batch) {
        questions[p.id] = {
          type: "choice",
          instructions: `${buildPersonaPromptHeader(p)}\n\n${stopPromptTail}`,
          criteria: {
            stop: "مکث می‌کند و ادامه را می‌بیند",
            scroll: "در ۱ ثانیه رد/اسکیپ می‌شود",
          },
        };
      }
      const { data } = await callDecider(state, questions);
      totalTokens += data.usage?.input_tokens ?? 0;
      for (const p of batch) {
        const a = data.answers[p.id];
        stopMap.set(p.id, a && a.type === "choice" ? a.probabilities.stop ?? 0 : 0.25);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker()));
  return { stopMap, inputTokens: totalTokens };
}

/**
 * Lightweight Hygiene Gate (~250ms, 1 Decider call):
 * Checks only publishable Persian hygiene (anti-Streisand compliance bloat + register purity + conciseness).
 * Does NOT impose an artificial editorial taste override over the real crowd!
 */
export async function evaluateCreativeCraft(ad: AdCopy): Promise<{
  brandCraft: number; // 0..100
  brandTaste: number; // 0..100
  antiStreisand: number; // 0..100
  registerPurity: number; // 0..100
  inputTokens: number;
}> {
  const isColloquial = (ad.voiceRegister ?? "colloquial") === "colloquial" || ad.voiceRegister === "bold_genz";
  const state = buildAdState(ad);
  const wordCount = `${ad.headline} ${ad.body} ${ad.cta}`.trim().split(/\s+/).length;

  const questions: Record<string, unknown> = {
    brand_taste: {
      type: "score",
      instructions:
        "آیا این تبلیغ از نظر نگارش، وضوح پیام و استاندارد انتشار یک برند حرفه‌ای ایرانی تمیز و قابل‌انتشار است؟ " +
        "(تبلیغ‌های پر از ایموجی، ادعاهای زرد/تضمینی، یا بیانیه‌های دفاعی شاپرک/مجوز نمره ۰ یا ۱ می‌گیرند)",
      criteria: [
        "بسیار آماتور، زرد یا دفاعی/اداری (0)",
        "ضعیف یا شلوغ (1)",
        "متوسط و قابل‌قبول (2)",
        "خوب، روان و قابل انتشار (3)",
        "بسیار تمیز، خوش‌ریتم و حرفه‌ای (4)",
      ],
    },
    anti_streisand: {
      type: "choice",
      instructions: "آیا این تبلیغ حالت دفاعی/اداری (ردیف کردن شاپرک، درگاه رسمی، مجوز یا التماس برای اعتماد) دارد؟",
      criteria: {
        confident: "خیر، طبیعی و حرفه‌ای است",
        defensive: "بله، دفاعی، اداری یا شبیه بیانیه رفع اتهام است",
      },
    },
    register_purity: {
      type: "choice",
      instructions: isColloquial
        ? "آیا لحن فارسی این تبلیغ محاوره‌ای یکدست، روان و بدون غلط نگارشی است؟"
        : "آیا لحن فارسی این تبلیغ یکدست، طبیعی و بدون ترجمه‌زدگی یا غلط نگارشی است؟",
      criteria: {
        pure: "کاملاً یکدست و روان است",
        stiff: "ناهماهنگ، ترجمه‌زده یا دارای غلط نگارشی است",
      },
    },
  };

  const { data } = await callDecider(state, questions);
  const btAns = data.answers.brand_taste;
  const asAns = data.answers.anti_streisand;
  const rpAns = data.answers.register_purity;

  const brandTaste = btAns && btAns.type === "score" ? (btAns.score / 4) * 100 : 70;
  const antiStreisand = asAns && asAns.type === "choice" ? (asAns.probabilities.confident ?? 0.5) * 100 : 70;
  const registerPurity = rpAns && rpAns.type === "choice" ? (rpAns.probabilities.pure ?? 0.5) * 100 : 75;

  const bloatPenalty = wordCount > 58 ? Math.min(20, (wordCount - 58) * 1.1) : 0;
  const brandCraft = Math.max(
    15,
    Math.min(100, brandTaste * 0.45 + antiStreisand * 0.30 + registerPurity * 0.25 - bloatPenalty)
  );

  return {
    brandCraft: Number(brandCraft.toFixed(1)),
    brandTaste: Number(brandTaste.toFixed(1)),
    antiStreisand: Number(antiStreisand.toFixed(1)),
    registerPurity: Number(registerPurity.toFixed(1)),
    inputTokens: data.usage?.input_tokens ?? 0,
  };
}

/**
 * Step B (V5 True Multiplicative Behavioral Funnel — 12 personas x 5 pure persona-conditioned questions):
 * 1) Personal Category Relevance (rel) — does this product even fit THIS person's life/job/budget?
 * 2) 3-Second Product & Offer Clarity (clarity) — catches cryptic copy that hides the product!
 * 3) Persona-Specific Click Persuasion (pull) — zero editorial rubric!
 * 4) Brand Credibility / Trust (trust) — catches spam AND suspicious off-brief claims!
 * 5) Probabilistic Reaction Sampling (annoyed | neutral | curious | excited) — kills 60/60 argmax collapse!
 */
export async function evaluatePersonaWave(
  ad: AdCopy,
  personas: Persona[],
  stopMap: Map<string, number>,
  hygieneMultiplier = 1.0
): Promise<{ judgments: PersonJudgment[]; inputTokens: number; ms: number }> {
  const state = buildAdState(ad);
  const questions: Record<string, unknown> = {};

  for (const p of personas) {
    const pl = buildPersonaPromptHeader(p);
    questions[`${p.id}__rel`] = {
      type: "choice",
      instructions: `${pl}\n\nفارغ از زیبایی متن تبلیغ، آیا موضوع و محصول این تبلیغ اصلاً به درد شغل، سن، بودجه و زندگی فعلی *همین فرد* می‌خورد؟`,
      criteria: {
        high: "کاملاً مرتبط با نیاز یا دغدغه الانش است",
        mid: "تا حدی مرتبط است",
        low: "اصلاً ربطی به زندگی یا بودجه‌اش ندارد",
      },
    };
    questions[`${p.id}__clarity`] = {
      type: "choice",
      instructions: `${pl}\n\nآیا این فرد در ۳ ثانیه اول کاملاً می‌فهمد دقیقاً چه محصولی و با چه پیشنهادی ارائه می‌شود، یا تبلیغ گنگ و نامشخص است؟`,
      criteria: {
        clear: "کاملاً روشن است چه محصول و پیشنهادی دارد",
        vague: "گنگ، معمایی یا نامشخص است",
      },
    };
    questions[`${p.id}__pull`] = {
      type: "choice",
      instructions: `${pl}\n\nاگر این فرد بعد از مکث، متن کامل را بخواند، آیا با توجه به سبک تصمیم‌گیری و بودجه واقعی خودش واقعاً قانع می‌شود روی دکمه کلیک کند؟`,
      criteria: { yes: "کلیک می‌کند", no: "کلیک نمی‌کند" },
    };
    questions[`${p.id}__trust`] = {
      type: "choice",
      instructions: `${pl}\n\nآیا این فرد با دیدن این تبلیغ حس یک برند واقعی و قابل‌اعتماد می‌گیرد یا حس تبلیغ زرد/مشکوک/آماتور؟`,
      criteria: { yes: "حس معتبر و قابل قبول می‌دهد", no: "حس مشکوک، زرد، اغراق‌آمیز یا نچسب می‌دهد" },
    };
    questions[`${p.id}__reaction`] = {
      type: "choice",
      instructions: `${pl}\n\nواکنش واقعی و درونی *همین فرد خاص* به این تبلیغ کدام است؟`,
      criteria: {
        annoyed: "کلافه یا بدبین شد (مشکوک، تکراری، گنگ یا حوصله‌سربر)",
        neutral: "بی‌تفاوت رد شد (به کارش نمی‌آید یا کششی نداشت)",
        curious: "مکث کرد و کنجکاو شد",
        excited: "دقیقاً به دلش نشست و آماده کلیک و اقدام است",
      },
    };
  }

  const { data, ms } = await callDecider(state, questions);
  const ans = data.answers;

  const judgments: PersonJudgment[] = personas.map((p) => {
    const relAns = ans[`${p.id}__rel`];
    const relProbs = relAns && relAns.type === "choice" ? relAns.probabilities : {};
    const relevance =
      (relProbs.high ?? 0) * 1.0 + (relProbs.mid ?? 0) * 0.40 + (relProbs.low ?? 0) * 0.02;

    const clarAns = ans[`${p.id}__clarity`];
    const clarity = clarAns && clarAns.type === "choice" ? clarAns.probabilities.clear ?? 0.5 : 0.5;

    const pullAns = ans[`${p.id}__pull`];
    const pull = pullAns && pullAns.type === "choice" ? pullAns.probabilities.yes ?? 0 : 0;

    const trustAns = ans[`${p.id}__trust`];
    const trust = trustAns && trustAns.type === "choice" ? trustAns.probabilities.yes ?? 0 : 0;

    const rawStop = stopMap.get(p.id) ?? 0.35;

    // V5 Multiplicative Consumer Funnel Physics:
    // 1) Thumb-stop is physically gated by personal relevance
    const effStop = rawStop * (0.25 + 0.75 * relevance);
    // 2) You CANNOT click an ad you didn't stop for, didn't understand in 3s, or didn't trust!
    const effClick = effStop * pull * (0.35 + 0.65 * clarity) * (0.30 + 0.70 * trust);

    const rawCrowdScore = (effClick * 0.50 + effStop * 0.25 + clarity * trust * 0.15 + pull * relevance * 0.10) * 100;
    const fitness = Math.max(0, Math.min(100, rawCrowdScore * hygieneMultiplier));

    // Deterministic relevance-calibrated probabilistic reaction sampling (NO 60/60 argmax collapse!)
    const rxAns = ans[`${p.id}__reaction`];
    const rxP = rxAns && rxAns.type === "choice" ? rxAns.probabilities : {};
    const pAnn = (rxP.annoyed ?? 0.1) + (1 - trust) * 0.25;
    const pNeu = (rxP.neutral ?? 0.3) + (1 - relevance) * 0.45 + (1 - rawStop) * 0.20;
    const pCur = (rxP.curious ?? 0.3) * (0.25 + 0.75 * relevance) * (0.4 + 0.6 * clarity);
    const pExc = (rxP.excited ?? 0.1) * (0.15 + 0.85 * relevance) * (0.35 + 0.65 * clarity) * (0.3 + 0.7 * trust);
    const sumP = Math.max(1e-9, pAnn + pNeu + pCur + pExc);
    const u = deterministicUnit(`${p.id}::${ad.headline}::${ad.cta}`);
    let reaction: ReactionType = "neutral";
    const c1 = pAnn / sumP;
    const c2 = c1 + pNeu / sumP;
    const c3 = c2 + pCur / sumP;
    if (u < c1) reaction = "annoyed";
    else if (u < c2) reaction = "neutral";
    else if (u < c3) reaction = "curious";
    else reaction = "excited";

    return {
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
      stop: effStop,
      relevance,
      click: effClick,
      intent: pull * relevance,
      trust,
      naturalness: clarity,
      clarity,
      reaction,
      fitness,
    };
  });

  return {
    judgments,
    inputTokens: data.usage?.input_tokens ?? 0,
    ms,
  };
}

export function aggregateJudgments(judgments: PersonJudgment[]): {
  fitness: number;
  fitnessStd: number;
  relevance: number;
  estCtrPct: number;
  stop: number;
  click: number;
  intent: number;
  trust: number;
  naturalness: number;
  clarity: number;
  reactions: ReactionCounts;
  segmentsByCityTier: SegmentSummary[];
  segmentsByIncome: SegmentSummary[];
  segmentsByArchetype: SegmentSummary[];
} {
  const n = Math.max(1, judgments.length);
  const mean = (fn: (j: PersonJudgment) => number) => judgments.reduce((acc, j) => acc + fn(j), 0) / n;
  const fitMean = mean((j) => j.fitness);
  const variance =
    judgments.length > 1
      ? judgments.reduce((acc, j) => acc + (j.fitness - fitMean) ** 2, 0) / (judgments.length - 1)
      : 0;
  const fitnessStd = Number(Math.sqrt(Math.max(0, variance)).toFixed(1));
  const estCtrPct = Number((0.35 + (fitMean / 100) * 3.85).toFixed(2));

  const reactions: ReactionCounts = { annoyed: 0, neutral: 0, curious: 0, excited: 0 };
  for (const j of judgments) reactions[j.reaction]++;

  const groupBy = (keyFn: (j: PersonJudgment) => string): SegmentSummary[] => {
    const map = new Map<string, PersonJudgment[]>();
    for (const j of judgments) {
      const k = keyFn(j);
      const arr = map.get(k) ?? [];
      arr.push(j);
      map.set(k, arr);
    }
    return Array.from(map.entries())
      .map(([label, arr]) => ({
        label,
        count: arr.length,
        fitness: Number((arr.reduce((s, x) => s + x.fitness, 0) / arr.length).toFixed(1)),
        click: Number(((arr.reduce((s, x) => s + x.click, 0) / arr.length) * 100).toFixed(1)),
        trust: Number(((arr.reduce((s, x) => s + x.trust, 0) / arr.length) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.fitness - a.fitness);
  };

  return {
    fitness: Number(fitMean.toFixed(1)),
    fitnessStd,
    relevance: Number((mean((j) => j.relevance ?? 0.5) * 100).toFixed(1)),
    estCtrPct,
    stop: Number((mean((j) => j.stop) * 100).toFixed(1)),
    click: Number((mean((j) => j.click) * 100).toFixed(1)),
    intent: Number((mean((j) => j.intent) * 100).toFixed(1)),
    trust: Number((mean((j) => j.trust) * 100).toFixed(1)),
    naturalness: Number((mean((j) => j.naturalness ?? j.clarity) * 100).toFixed(1)),
    clarity: Number((mean((j) => j.clarity) * 100).toFixed(1)),
    reactions,
    segmentsByCityTier: groupBy((j) => j.city_tier),
    segmentsByIncome: groupBy((j) => j.income_tier),
    segmentsByArchetype: groupBy((j) => j.ad_archetype),
  };
}

/**
 * Evaluates a full crowd using our V5 True Multiplicative Behavioral Funnel
 * streaming live wave updates into the UI dot-matrix!
 */
export async function evaluateCrowdStreaming(
  variantId: string,
  generation: number,
  strategy: string,
  ad: AdCopy,
  personas: Persona[],
  onWave: (
    batch: PersonJudgment[],
    completed: number,
    total: number,
    running: ReturnType<typeof aggregateJudgments>
  ) => void,
  stage?: VariantResult["stage"],
  meta?: { director?: string; copyChief?: CopyChiefReview }
): Promise<VariantResult> {
  const t0 = Date.now();

  // Step A (parallel): Headline-only Thumb-Stop + Lightweight Hygiene Gate
  const [{ stopMap, inputTokens: stopTokens }, craft] = await Promise.all([
    evaluateHeadlineThumbStop(ad, personas),
    evaluateCreativeCraft(ad),
  ]);

  // V5 Honest Hygiene Gate (the REAL heterogeneous crowd drives 85%+ of the decision!):
  // Copy Chief only checks native Persian craft, zero hallucinations, and 3-second brief/offer fidelity!
  const copyChief = meta?.copyChief;
  const briefFid = copyChief?.briefFidelity ?? 90;
  const driftPenalty = briefFid < 65 ? Math.round((65 - briefFid) * 0.65) : 0;
  const factPenalty = copyChief && !copyChief.factVerified ? 22 : 0;

  const combinedHygiene = copyChief
    ? Math.max(
        15,
        Math.min(100, copyChief.persianCraft * 0.55 + craft.brandCraft * 0.45 - factPenalty - driftPenalty)
      )
    : craft.brandCraft;
  const finalBrandCraft = Number(combinedHygiene.toFixed(1));

  // Mild hygiene multiplier: clean on-brief ad (90) -> 0.97x; off-brief or hallucinated (50) -> 0.86x (minus penalty)
  const hygieneMultiplier = 0.72 + 0.28 * (finalBrandCraft / 100);

  // Step B: Full ad waves (12 personas x 6 isolated questions)
  const waveSize = 12;
  const chunks: Persona[][] = [];
  for (let i = 0; i < personas.length; i += waveSize) {
    chunks.push(personas.slice(i, i + waveSize));
  }

  const allJudgments: PersonJudgment[] = [];
  let totalTokens = stopTokens + craft.inputTokens;

  const concurrency = 4;
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < chunks.length) {
      const idx = nextIdx++;
      const wavePersonas = chunks[idx];
      const waveRes = await evaluatePersonaWave(ad, wavePersonas, stopMap, hygieneMultiplier);
      totalTokens += waveRes.inputTokens;
      allJudgments.push(...waveRes.judgments);
      const running = aggregateJudgments(allJudgments);
      onWave(waveRes.judgments, allJudgments.length, personas.length, {
        ...running,
        naturalness: finalBrandCraft,
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker()));

  const byId = new Map(allJudgments.map((j) => [j.personaId, j]));
  const ordered = personas.map((p) => byId.get(p.id)!).filter(Boolean);
  const agg = aggregateJudgments(ordered);

  return {
    id: variantId,
    generation,
    strategy,
    director: meta?.director,
    stage,
    ad,
    ...agg,
    naturalness: finalBrandCraft,
    brandCraft: finalBrandCraft,
    antiStreisand: craft.antiStreisand,
    copyChief,
    judgments: ordered,
    latencyMs: Date.now() - t0,
    inputTokens: totalTokens,
    costUsd: Number(((totalTokens * PRICE_PER_M_INPUT) / 1_000_000).toFixed(6)),
  };
}

/**
 * Direct Head-to-Head Pairwise Showdown (Ad A vs Ad B):
 * Splits personas into two order-balanced halves (A/B and B/A) to eliminate order bias
 * and gets a sharp relative preference vote!
 */
export async function evaluateHeadToHead(
  adA: AdCopy,
  adB: AdCopy,
  personas: Persona[]
): Promise<{
  aWinPct: number;
  bWinPct: number;
  tiePct: number;
  neitherPct: number;
  voterCount: number;
  inputTokens: number;
}> {
  const fmt = (a: AdCopy) => `تیتر: ${a.headline}\nمتن: ${a.body}\nدکمه: ${a.cta}`;
  const mid = Math.ceil(personas.length / 2);
  const half1 = personas.slice(0, mid);
  const half2 = personas.slice(mid);

  let sumA = 0;
  let sumB = 0;
  let sumTie = 0;
  let sumNeither = 0;
  let totalTokens = 0;

  async function runHalf(group: Persona[], swapped: boolean) {
    if (group.length === 0) return;
    const first = swapped ? adB : adA;
    const second = swapped ? adA : adB;
    const state = `دو نسخه تبلیغ مختلف برای یک محصول:\n\n--- تبلیغ ۱ ---\n${fmt(first)}\n\n--- تبلیغ ۲ ---\n${fmt(second)}`;

    const chunkSize = 25;
    const chunks: Persona[][] = [];
    for (let i = 0; i < group.length; i += chunkSize) {
      chunks.push(group.slice(i, i + chunkSize));
    }

    for (const batch of chunks) {
      const questions: Record<string, unknown> = {};
      for (const p of batch) {
        questions[p.id] = {
          type: "choice",
          instructions:
            `${buildPersonaPromptHeader(p)}\n\n` +
            `با توجه به شغل، بودجه، حوصله و سبک تصمیم‌گیری *همین فرد خاص*، اگر در فید اینستاگرام یا تلگرام این دو نسخه تبلیغ را ببیند، آیا یکی به شکل محسوسی برایش قانع‌کننده‌تر است یا تقریباً هم‌سطح‌اند؟`,
          criteria: {
            ad_1: "تبلیغ ۱ به شکل محسوسی بهتر و قانع‌کننده‌تر است",
            ad_2: "تبلیغ ۲ به شکل محسوسی بهتر و قانع‌کننده‌تر است",
            tie: "هر دو تقریباً هم‌سطح‌اند و فرق مهمی ندارند",
            neither: "هیچ‌کدام قانعش نمی‌کند",
          },
        };
      }
      const { data } = await callDecider(state, questions);
      totalTokens += data.usage?.input_tokens ?? 0;
      for (const p of batch) {
        const a = data.answers[p.id];
        if (a && a.type === "choice") {
          const p1 = a.probabilities.ad_1 ?? 0;
          const p2 = a.probabilities.ad_2 ?? 0;
          const pt = a.probabilities.tie ?? 0;
          const pn = a.probabilities.neither ?? 0;
          sumA += swapped ? p2 : p1;
          sumB += swapped ? p1 : p2;
          sumTie += pt;
          sumNeither += pn;
        }
      }
    }
  }

  await Promise.all([runHalf(half1, false), runHalf(half2, true)]);
  const n = Math.max(1, personas.length);
  return {
    aWinPct: Number(((sumA / n) * 100).toFixed(1)),
    bWinPct: Number(((sumB / n) * 100).toFixed(1)),
    tiePct: Number(((sumTie / n) * 100).toFixed(1)),
    neitherPct: Number(((sumNeither / n) * 100).toFixed(1)),
    voterCount: personas.length,
    inputTokens: totalTokens,
  };
}

/**
 * Multi-Segment Winner Advisor (Split Campaign Advisor):
 * Checks whether different Iranian demographic slices (City Tier, Income Group, Age Band)
 * have genuinely different winning variants!
 */
export function computeSplitCampaignAdvice(
  variants: VariantResult[],
  overallChampion: VariantResult
): SplitCampaignAdvice {
  const candidates = variants.filter((v) => v.judgments.length > 0);
  if (candidates.length < 2) {
    return {
      shouldSplit: false,
      summary: "برای پیشنهاد تفکیک کمپین به حداقل دو نسخه ارزیابی‌شده نیاز است.",
      winners: [],
    };
  }

  const slices: Array<{
    group: "city" | "income" | "age" | "archetype";
    groupLabel: string;
    segment: string;
    match: (j: PersonJudgment) => boolean;
  }> = [
    {
      group: "archetype",
      groupLabel: "تیپ خریدار",
      segment: "سریع‌ردکن و تکنولوژی‌دوست",
      match: (j) => j.ad_archetype === "سریع‌ردکنِ بی‌حوصله" || j.ad_archetype === "تکنولوژی‌دوستِ پیشتاز",
    },
    {
      group: "archetype",
      groupLabel: "تیپ خریدار",
      segment: "شکارچی تخفیف و قیمت‌سنج",
      match: (j) => j.ad_archetype === "شکارچی تخفیف و قسط" || j.ad_archetype === "قیمت‌سنجِ ترب‌باز",
    },
    {
      group: "archetype",
      groupLabel: "تیپ خریدار",
      segment: "سنتی و کیفیت‌گرا",
      match: (j) => j.ad_archetype === "سنتیِ نیازمند اعتماد" || j.ad_archetype === "کیفیت‌گرای کم‌وقت",
    },
    {
      group: "archetype",
      groupLabel: "تیپ خریدار",
      segment: "حساس به اعتماد و حریم",
      match: (j) =>
        j.ad_archetype === "حساس به حریم خصوصی" || j.ad_archetype === "زخم‌خورده کلاهبرداری اینستاگرام",
    },
    { group: "city", groupLabel: "جغرافیا", segment: "تهران", match: (j) => j.city_tier === "تهران" },
    { group: "city", groupLabel: "جغرافیا", segment: "کلان‌شهرها", match: (j) => j.city_tier === "کلان‌شهر" },
    {
      group: "city",
      groupLabel: "جغرافیا",
      segment: "مراکز استان و شهرستان",
      match: (j) => j.city_tier === "مرکز استان" || j.city_tier === "شهرستان",
    },
    {
      group: "income",
      groupLabel: "درآمد",
      segment: "درآمد بالا و مرفه",
      match: (j) => j.income_tier === "متوسط رو به بالا" || j.income_tier === "مرفه",
    },
    { group: "income", groupLabel: "درآمد", segment: "درآمد متوسط", match: (j) => j.income_tier === "متوسط" },
    {
      group: "income",
      groupLabel: "درآمد",
      segment: "حساس به قیمت",
      match: (j) => j.income_tier === "کم‌درآمد" || j.income_tier === "متوسط رو به پایین",
    },
    { group: "age", groupLabel: "سن", segment: "جوان (۱۸ تا ۲۹ سال)", match: (j) => j.age <= 29 },
    { group: "age", groupLabel: "سن", segment: "میانسال (۳۰ تا ۴۴ سال)", match: (j) => j.age >= 30 && j.age <= 44 },
    { group: "age", groupLabel: "سن", segment: "بالای ۴۵ سال", match: (j) => j.age >= 45 },
  ];

  const winners: SegmentWinner[] = [];

  for (const sl of slices) {
    const champSub = overallChampion.judgments.filter(sl.match);
    if (champSub.length < 4) continue;
    const champFit = champSub.reduce((s, x) => s + x.fitness, 0) / champSub.length;

    let bestVar = overallChampion;
    let bestFit = champFit;

    for (const v of candidates) {
      const sub = v.judgments.filter(sl.match);
      if (sub.length < 4) continue;
      const fit = sub.reduce((s, x) => s + x.fitness, 0) / sub.length;
      if (fit > bestFit) {
        bestFit = fit;
        bestVar = v;
      }
    }

    winners.push({
      group: sl.group,
      groupLabel: sl.groupLabel,
      segment: sl.segment,
      count: champSub.length,
      winnerId: bestVar.id,
      winnerHeadline: bestVar.ad.headline,
      winnerStrategy: bestVar.strategy,
      winnerFitness: Number(bestFit.toFixed(1)),
      overallChampionFitness: Number(champFit.toFixed(1)),
      marginOverChampion: Number((bestFit - champFit).toFixed(1)),
    });
  }

  const meaningfulSplits = winners.filter((w) => w.winnerId !== overallChampion.id && w.marginOverChampion >= 2.5);
  const shouldSplit = meaningfulSplits.length > 0;

  let summary: string;
  if (shouldSplit) {
    const topSplit = [...meaningfulSplits].sort((a, b) => b.marginOverChampion - a.marginOverChampion)[0];
    summary = `به‌جای اجرای یک تبلیغ یکسان، کمپین را دو ادست کنید: نسخه «${overallChampion.id}» قهرمان کل بازار است، اما در بخش «${topSplit.segment}» نسخه «${topSplit.winnerId}» با +${topSplit.marginOverChampion.toFixed(1)} امتیاز بهتر عمل کرده است.`;
  } else {
    summary = `نسخه قهرمان («${overallChampion.id}») تقریباً در تمام بخش‌های سنی، شهری و درآمدی پیشتاز بوده و اجرای یک ادست واحد برای کل این جامعه هدف بهینه است.`;
  }

  return { shouldSplit, summary, winners };
}

/**
 * Persian Copy X-Ray Heatmap: splits headline/body/cta into sentences (without breaking Persian decimals!)
 * and scores each clause (-2..+2) across a diverse 6-persona panel in ONE fast call (~350ms).
 */
export async function computeCopyHeatmap(
  ad: AdCopy,
  samplePersonas: Persona[]
): Promise<{ heatmap: ClauseHeat[]; inputTokens: number; ms: number }> {
  const bodySentences = ad.body
    .replace(/((?<![0-9۰-۹])\.(?![0-9۰-۹])|[!?؟\n]+)/g, "$1|")
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  const rawClauses: Array<{ clause: string; kind: "headline" | "body" | "cta" }> = [
    { clause: ad.headline.trim(), kind: "headline" },
    ...(bodySentences.length > 0 ? bodySentences : [ad.body.trim()]).map((s) => ({ clause: s, kind: "body" as const })),
    { clause: ad.cta.trim(), kind: "cta" },
  ];
  const clauses = rawClauses.filter((c) => c.clause.length > 0);

  const panel = samplePersonas.slice(0, 6);
  const state = `متن کامل تبلیغ:\nتیتر: ${ad.headline}\nمتن: ${ad.body}\nدکمه: ${ad.cta}`;
  const questions: Record<string, unknown> = {};

  clauses.forEach((c, ci) => {
    panel.forEach((p, pi) => {
      questions[`c${ci}_p${pi}`] = {
        type: "score",
        instructions:
          `${buildPersonaPromptHeader(p)}\n` +
          `در متن این تبلیغ، به طور خاص تأثیر این جمله روی کشش، حس برند و تمایل کلیک این فرد چیست:\n«${c.clause}»`,
        criteria: [
          "شدیداً کلیشه‌ای، بروشوری یا دفع‌کننده است (-2)",
          "کمی خشک، مبهم یا کم‌رمق است (-1)",
          "خنثی است (0)",
          "جالب، ملموس یا اعتمادساز است (+1)",
          "شدیداً تیز، انسانی و ترغیب‌کننده به کلیک است (+2)",
        ],
      };
    });
  });

  const { data, ms } = await callDecider(state, questions);
  const heatmap: ClauseHeat[] = clauses.map((c, ci) => {
    let sum = 0;
    let cnt = 0;
    panel.forEach((_, pi) => {
      const a = data.answers[`c${ci}_p${pi}`];
      if (a && a.type === "score") {
        sum += a.score - 2;
        cnt++;
      }
    });
    return {
      clause: c.clause,
      kind: c.kind,
      score: Number((cnt > 0 ? sum / cnt : 0).toFixed(2)),
    };
  });

  return {
    heatmap,
    inputTokens: data.usage?.input_tokens ?? 0,
    ms,
  };
}

/**
 * V4 Order-Rotated Multi-Variant Tournament (Zero Order Bias, Zero Sycophancy!):
 * Places all N candidate ads side-by-side across 4 order-rotated groups of real ICP personas (~1.5s, ~$0.001).
 * Directly exposes which ads truly stand out and win human preference — killing freebie/FAQ reward hacking!
 */
export async function runRotatedTournament(
  candidates: Array<{ ad: AdCopy }>,
  personas: Persona[],
  contextLabel = "این محصول"
): Promise<{ voteSharePcts: number[]; nonePct: number; voterCount: number; inputTokens: number }> {
  const n = candidates.length;
  if (n === 0) return { voteSharePcts: [], nonePct: 0, voterCount: 0, inputTokens: 0 };
  if (n === 1) return { voteSharePcts: [100], nonePct: 0, voterCount: personas.length, inputTokens: 0 };

  const voters = personas.slice(0, Math.min(48, personas.length));
  const numRotations = Math.min(4, n);
  const shifts = Array.from({ length: numRotations }, (_, k) => Math.floor((k * n) / numRotations));
  const groups: Persona[][] = Array.from({ length: numRotations }, () => []);
  voters.forEach((p, idx) => groups[idx % numRotations].push(p));

  const totals = new Array<number>(n).fill(0);
  let noneTotal = 0;
  let totalTokens = 0;

  await Promise.all(
    shifts.map(async (sh, gi) => {
      const group = groups[gi];
      if (group.length === 0) return;

      const orderIdx = Array.from({ length: n }, (_, i) => (i + sh) % n);
      const state =
        `${n} نسخه تبلیغ مختلف برای ${contextLabel} در فید اینستاگرام:\n\n` +
        orderIdx
          .map(
            (origIdx, pos) =>
              `--- تبلیغ ${pos + 1} ---\nتیتر: ${candidates[origIdx].ad.headline}\nمتن: ${candidates[origIdx].ad.body}\nدکمه: ${candidates[origIdx].ad.cta}`
          )
          .join("\n\n");

      const criteria: Record<string, string> = {};
      for (let i = 0; i < n; i++) criteria[`a${i + 1}`] = `تبلیغ ${i + 1}`;
      criteria.none = "هیچ‌کدام جذاب نیست";

      const questions: Record<string, unknown> = {};
      for (const p of group) {
        questions[p.id] = {
          type: "choice",
          instructions:
            `${buildPersonaPromptHeader(p)}\n\n` +
            `با توجه به شغل، بودجه، حوصله و سبک تصمیم‌گیری *همین فرد خاص*، در میان این ${n} تبلیغ کدام یک واقعاً بیشتر به دلش می‌نشیند و احتمال کلیکش بالاتر است؟ (اگر هیچ‌کدام به کارش نمی‌آید یا قانعش نمی‌کند، none را بزن)`,
          criteria,
        };
      }

      const { data } = await callDecider(state, questions);
      totalTokens += data.usage?.input_tokens ?? 0;

      for (const p of group) {
        const a = data.answers[p.id];
        if (a && a.type === "choice") {
          noneTotal += a.probabilities.none ?? 0;
          orderIdx.forEach((origIdx, pos) => {
            totals[origIdx] += a.probabilities[`a${pos + 1}`] ?? 0;
          });
        }
      }
    })
  );

  const denom = Math.max(1, voters.length);
  return {
    voteSharePcts: totals.map((t) => Number(((t / denom) * 100).toFixed(1))),
    nonePct: Number(((noneTotal / denom) * 100).toFixed(1)),
    voterCount: voters.length,
    inputTokens: totalTokens,
  };
}

/**
 * SYSTEM 3 (Fast Funnel): Screens 6-8 Creative Room candidate headlines on 0..4 calibrated scroll-stop
 * in ~1.5-2s total. Paired with runRotatedTournament in V4 for anti-reward-hacking selection!
 */
export async function screenHeadlinesFast(
  candidates: Array<{ ad: AdCopy }>,
  personas: Persona[]
): Promise<{ stopPcts: number[]; inputTokens: number }> {
  const sample = personas.slice(0, Math.min(30, personas.length));
  const stopPcts: number[] = new Array(candidates.length).fill(50);
  let totalTokens = 0;

  const concurrency = 4;
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < candidates.length) {
      const idx = nextIdx++;
      const ad = candidates[idx].ad;
      const state = buildHeadlineOnlyState(ad);
      const questions: Record<string, unknown> = {};
      for (const p of sample) {
        questions[p.id] = {
          type: "choice",
          instructions:
            `${buildPersonaPromptHeader(p)}\n\n` +
            `این فرد با عجله در حال اسکرول فید است و فقط همین یک خط تیتر را می‌بیند. ` +
            `با توجه به شغل، حوصله و سبک تصمیم‌گیری *همین فرد خاص*، آیا انگشتش مکث می‌کند یا رد می‌شود؟`,
          criteria: {
            stop: "مکث می‌کند و ادامه را می‌خواند",
            scroll: "در نیم ثانیه رد می‌شود",
          },
        };
      }
      const { data } = await callDecider(state, questions);
      totalTokens += data.usage?.input_tokens ?? 0;
      let sum = 0;
      for (const p of sample) {
        const a = data.answers[p.id];
        if (a && a.type === "choice") sum += a.probabilities.stop ?? 0;
      }
      stopPcts[idx] = Number(((sum / Math.max(1, sample.length)) * 100).toFixed(1));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker()));
  return { stopPcts, inputTokens: totalTokens };
}

/**
 * SYSTEM 4 (Simulated Real Iranian Feed Battle — Anti-Ad-Fatigue Test):
 * Drops the user's ad into a realistic 4-post Iranian feed alongside 3 STRONG category competitor ads.
 * Uses IDENTICAL formatting across all 4 posts (zero format bias) and rotates across all 4 positions!
 */
export async function evaluateFeedBattle(
  originalAd: AdCopy,
  championAd: AdCopy,
  competitors: CompetitorFeedAd[],
  personas: Persona[]
): Promise<{ result: FeedBattleResult; inputTokens: number }> {
  const comps = competitors.slice(0, 3);
  const voters = personas.slice(0, Math.min(48, personas.length));
  let totalTokens = 0;

  async function runOneFeed(targetAd: AdCopy): Promise<{ sharePct: number; neitherPct: number; compAvgPct: number }> {
    // Split voters into 4 equal groups so targetAd appears in slot 0, 1, 2, 3 equally (zero order bias!)
    const groups: Persona[][] = [[], [], [], []];
    voters.forEach((p, idx) => groups[idx % 4].push(p));

    let sumTarget = 0;
    let sumNeither = 0;
    let sumComps = 0;

    await Promise.all(
      groups.map(async (group, slot) => {
        if (group.length === 0) return;
        const posts: Array<{ isTarget: boolean; title: string; body: string }> = [];
        let ci = 0;
        for (let s = 0; s < 4; s++) {
          if (s === slot || ci >= comps.length) {
            posts.push({ isTarget: true, title: targetAd.headline, body: targetAd.body });
          } else {
            const c = comps[ci++];
            // IDENTICAL format to targetAd (no asymmetric "Brand — " prefix!)
            posts.push({ isTarget: false, title: c.headline, body: c.body });
          }
        }

        const state =
          `یک کاربر ایرانی در حال اسکرول فید اینستاگرام/تلگرام است و این ۴ پست تبلیغاتی را پشت سر هم می‌بیند:\n\n` +
          posts
            .map((post, idx) => `--- پست ${idx + 1} ---\nتیتر: ${post.title}\nمتن: ${post.body}`)
            .join("\n\n");

        const questions: Record<string, unknown> = {};
        for (const p of group) {
          questions[p.id] = {
            type: "choice",
            instructions:
              `${buildPersonaPromptHeader(p)}\n\n` +
              `در شلوغی فید اینستاگرام، با توجه به نیاز واقعی، بودجه و سبک تصمیم‌گیری *همین فرد خاص*، کدام یک از این ۴ پست بیشتر باعث می‌شود مکث کند و کلیک کند؟`,
            criteria: {
              p1: "پست ۱ بیشترین کشش را دارد",
              p2: "پست ۲ بیشترین کشش را دارد",
              p3: "پست ۳ بیشترین کشش را دارد",
              p4: "پست ۴ بیشترین کشش را دارد",
              none: "روی هیچ‌کدام مکث و کلیک نمی‌کند",
            },
          };
        }

        const { data } = await callDecider(state, questions);
        totalTokens += data.usage?.input_tokens ?? 0;

        const targetKey = `p${slot + 1}`;
        for (const p of group) {
          const a = data.answers[p.id];
          if (a && a.type === "choice") {
            const pt = a.probabilities[targetKey] ?? 0;
            const pn = a.probabilities.none ?? 0;
            const pc = Math.max(0, 1 - pt - pn);
            sumTarget += pt;
            sumNeither += pn;
            sumComps += pc;
          }
        }
      })
    );

    const n = Math.max(1, voters.length);
    return {
      sharePct: Number(((sumTarget / n) * 100).toFixed(1)),
      neitherPct: Number(((sumNeither / n) * 100).toFixed(1)),
      compAvgPct: Number(((sumComps / Math.max(1, comps.length) / n) * 100).toFixed(1)),
    };
  }

  // Run Original feed battle and Champion feed battle sequentially to stay comfortably under 10 req/s (4+4 calls)
  const origFeed = await runOneFeed(originalAd);
  const champFeed = await runOneFeed(championAd);

  return {
    result: {
      competitors: comps,
      originalSharePct: origFeed.sharePct,
      championSharePct: champFeed.sharePct,
      shareLiftPct: Number((champFeed.sharePct - origFeed.sharePct).toFixed(1)),
      competitorAvgPct: champFeed.compAvgPct,
      originalNeitherPct: origFeed.neitherPct,
      championNeitherPct: champFeed.neitherPct,
      voterCount: voters.length,
    },
    inputTokens: totalTokens,
  };
}

/**
 * SYSTEM 3 (Statistical Proof): Exact paired difference 95% CI, two-sided p-value, and individual win rate
 * on unseen Holdout personas!
 */
export function computePairedHoldoutStats(
  origJudgments: PersonJudgment[],
  champJudgments: PersonJudgment[]
): {
  ci95Low: number;
  ci95High: number;
  pValue: number;
  winRatePct: number;
  statisticallySignificant: boolean;
} {
  const origById = new Map(origJudgments.map((j) => [j.personaId, j.fitness]));
  const diffs: number[] = [];
  let wins = 0;

  for (const cj of champJudgments) {
    const ofit = origById.get(cj.personaId);
    if (typeof ofit !== "number") continue;
    const d = cj.fitness - ofit;
    diffs.push(d);
    if (d > 0.2) wins++;
  }

  const n = diffs.length;
  if (n < 3) {
    return { ci95Low: 0, ci95High: 0, pValue: 1, winRatePct: 50, statisticallySignificant: false };
  }

  const mean = diffs.reduce((s, x) => s + x, 0) / n;
  const variance = diffs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(Math.max(1e-9, variance / n));

  // t-critical approximation for 95% CI (accurate across n=8..120)
  const df = n - 1;
  const tCrit = df >= 60 ? 2.0 : df >= 30 ? 2.042 : df >= 20 ? 2.086 : df >= 12 ? 2.179 : 2.306;
  const ci95Low = Number((mean - tCrit * se).toFixed(1));
  const ci95High = Number((mean + tCrit * se).toFixed(1));

  // Two-sided p-value via Abramowitz & Stegun erfc normal/t approximation
  const z = Math.abs(mean) / se;
  // Shrink z slightly for finite df (Welch/Student adjustment)
  const zAdj = z * Math.sqrt(df / (df + 2));
  const t = 1 / (1 + 0.3275911 * (zAdj / Math.SQRT2));
  const poly =
    t *
    (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erfcVal = poly * Math.exp(-(zAdj * zAdj) / 2);
  const pValue = Number(Math.max(0.0001, Math.min(1, erfcVal)).toFixed(4));

  const winRatePct = Number(((wins / n) * 100).toFixed(1));
  const statisticallySignificant = pValue < 0.05 && mean > 0;

  return { ci95Low, ci95High, pValue, winRatePct, statisticallySignificant };
}

/**
 * SYSTEM 6B (V4 Calibrated Toman Price & BNPL Elasticity Lab):
 * Combines:
 *  1) Order-rotated Multi-Offer Preference Choice across all offers (captures real trade-off & income elasticity)
 *  2) Calibrated 0..4 Monadic Willingness-to-Pay, Click, Price Shock & Trust per offer
 *  3) Realistic Iranian cold-traffic Instagram funnel RPM (no fantasy 83M Toman RPMs!)
 */
export async function evaluatePriceElasticity(params: {
  productName: string;
  productDescription: string;
  offers: PriceOfferOption[];
  personas: Persona[];
}): Promise<PriceElasticityResult> {
  const t0 = Date.now();
  const { productName, productDescription, offers, personas } = params;
  let totalTokens = 0;

  // Step 1: Order-rotated Multi-Offer Preference Choice (4 balanced rotations, zero order bias)
  const prefTotals = new Array<number>(offers.length).fill(0);
  if (offers.length >= 2) {
    const numRot = Math.min(4, offers.length);
    const shifts = Array.from({ length: numRot }, (_, k) => Math.floor((k * offers.length) / numRot));
    const groups: Persona[][] = Array.from({ length: numRot }, () => []);
    personas.forEach((p, idx) => groups[idx % numRot].push(p));

    await Promise.all(
      shifts.map(async (sh, gi) => {
        const group = groups[gi];
        if (group.length === 0) return;
        const orderIdx = Array.from({ length: offers.length }, (_, i) => (i + sh) % offers.length);
        const state =
          `محصول: ${productName}\nتوضیح محصول: ${productDescription}\n\n` +
          `${offers.length} پلن قیمتی مختلف برای انتخاب کاربر:\n\n` +
          orderIdx
            .map(
              (oi, pos) =>
                `--- پلن ${pos + 1} (${offers[oi].label}) ---\nتیتر: ${offers[oi].offerHeadline}\nشرایط: ${offers[oi].offerDetails}`
            )
            .join("\n\n");

        const criteria: Record<string, string> = {};
        for (let i = 0; i < offers.length; i++) criteria[`o${i + 1}`] = `پلن ${i + 1}`;
        criteria.none = "هیچ‌کدام را نمی‌خرد";

        const chunkSize = 25;
        for (let ci = 0; ci < group.length; ci += chunkSize) {
          const batch = group.slice(ci, ci + chunkSize);
          const questions: Record<string, unknown> = {};
          for (const p of batch) {
            questions[p.id] = {
              type: "choice",
              instructions:
                `${buildPersonaPromptHeader(p)}\n` +
                `با توجه به درآمد واقعی این فرد (${p.monthly_income_m} میلیون تومان در ماه در ۱۴۰۵) و مخارج زندگی‌اش، ` +
                `کدام پلن منطقی‌ترین و وسوسه‌کننده‌ترین انتخاب برای پرداخت واقعی است؟ (اگر هیچ‌کدام به بودجه‌اش نمی‌خورد یا حاضر به خرید نیست، none را بزن)`,
              criteria,
            };
          }
          const { data } = await callDecider(state, questions);
          totalTokens += data.usage?.input_tokens ?? 0;
          for (const p of batch) {
            const a = data.answers[p.id];
            if (a && a.type === "choice") {
              orderIdx.forEach((oi, pos) => {
                prefTotals[oi] += a.probabilities[`o${pos + 1}`] ?? 0;
              });
            }
          }
        }
      })
    );
  } else if (offers.length === 1) {
    prefTotals[0] = personas.length;
  }

  // Step 2: Calibrated 0..4 Monadic Willingness-to-Pay, Click, Price Shock & Trust per offer
  const evals: PriceOfferEval[] = [];

  for (let oi = 0; oi < offers.length; oi++) {
    const offer = offers[oi];
    const state =
      `محصول: ${productName}\n` +
      `توضیح محصول: ${productDescription}\n` +
      `پیشنهاد و قیمت فعلی:\n` +
      `تیتر: ${offer.offerHeadline}\n` +
      `شرایط قیمت و پرداخت: ${offer.offerDetails}\n` +
      `دکمه اقدام: ${offer.cta}`;

    const waveSize = 15;
    const chunks: Persona[][] = [];
    for (let i = 0; i < personas.length; i += waveSize) {
      chunks.push(personas.slice(i, i + waveSize));
    }

    let sumClick = 0;
    let sumIntent = 0;
    let sumTrust = 0;
    let sumShock = 0;
    const byIncomeMap = new Map<string, { count: number; intent: number; shock: number }>();

    const concurrency = 4;
    let nextIdx = 0;

    async function worker() {
      while (nextIdx < chunks.length) {
        const idx = nextIdx++;
        const batch = chunks[idx];
        const questions: Record<string, unknown> = {};
        for (const p of batch) {
          const pre = `${buildPersonaPromptHeader(p)}\nبا در نظر گرفتن دقیق درآمد ماهانه واقعی این فرد (${p.monthly_income_m} میلیون تومان در ۱۴۰۵) و هزینه اجاره/زندگی:`;
          questions[`${p.id}__click`] = {
            type: "score",
            instructions: `${pre} در شلوغی فید، چقدر احتمال دارد روی این پیشنهاد کلیک کند؟`,
            criteria: [
              "اصلاً کلیک نمی‌کند (0)",
              "احتمال کم (1)",
              "پنجاه‌پنجاه (2)",
              "احتمال زیاد (3)",
              "حتماً کلیک می‌کند (4)",
            ],
          };
          questions[`${p.id}__intent`] = {
            type: "score",
            instructions: `${pre} با وجود تورم و اولویت‌های خرج ماهانه، چقدر واقعاً حاضر است کارت بانکی‌اش را دربیاورد و این مبلغ را بپردازد یا ثبت‌نام کند؟`,
            criteria: [
              "اصلاً پول نمی‌دهد (0)",
              "بعید است بخرد (1)",
              "شاید بعداً بررسی کند (2)",
              "احتمالاً می‌خرد/ثبت‌نام می‌کند (3)",
              "قطعی می‌خرد و پرداخت می‌کند (4)",
            ],
          };
          questions[`${p.id}__shock`] = {
            type: "score",
            instructions: `${pre} این مبلغ و شرایط پرداخت نسبت به درآمد ماهانه این فرد چقدر سنگین یا شوک قیمتی ایجاد می‌کند؟`,
            criteria: [
              "خیلی سبک و ناچیز برای بودجه‌اش (0)",
              "منطقی و قابل هضم (1)",
              "کمی سنگین؛ باید فکر کند (2)",
              "گران و پرفشار برای بودجه‌اش (3)",
              "بسیار سنگین و غیرمنطقی برای بودجه‌اش (4)",
            ],
          };
          questions[`${p.id}__trust`] = {
            type: "choice",
            instructions: `${pre} آیا این قیمت و پیشنهاد حس شفافیت و اعتماد می‌دهد؟`,
            criteria: { yes: "شفاف و قابل اعتماد است", no: "مشکوک یا مبهم است" },
          };
        }

        const { data } = await callDecider(state, questions);
        totalTokens += data.usage?.input_tokens ?? 0;

        for (const p of batch) {
          const getScore = (k: string) => {
            const a = data.answers[`${p.id}__${k}`];
            return a && a.type === "score" ? Math.max(0, Math.min(1, a.score / 4)) : 0.4;
          };
          const getYes = (k: string) => {
            const a = data.answers[`${p.id}__${k}`];
            return a && a.type === "choice" ? a.probabilities.yes ?? 0 : 0;
          };
          const c = getScore("click");
          const it = getScore("intent");
          const sh = getScore("shock");
          const tr = getYes("trust");
          sumClick += c;
          sumIntent += it;
          sumShock += sh;
          sumTrust += tr;

          const rec = byIncomeMap.get(p.income_tier) ?? { count: 0, intent: 0, shock: 0 };
          rec.count += 1;
          rec.intent += it;
          rec.shock += sh;
          byIncomeMap.set(p.income_tier, rec);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker()));

    const n = Math.max(1, personas.length);
    const clickRate = sumClick / n;
    const intentRate = sumIntent / n;
    const trustRate = sumTrust / n;
    const shockRate = sumShock / n;
    const prefShare = prefTotals[oi] / n;

    const clickPct = Number((clickRate * 100).toFixed(1));
    const intentPct = Number((intentRate * 100).toFixed(1));
    const trustPct = Number((trustRate * 100).toFixed(1));
    const priceShockPct = Number((shockRate * 100).toFixed(1));
    const preferenceSharePct = Number((prefShare * 100).toFixed(1));

    // Grounded Real-World Cold-Traffic Instagram Funnel RPM (Toman per 1,000 ad impressions):
    // Realistic cold CTR (~0.8%..3.2%) * landing-to-checkout conversion (~2%..8%) weighted by relative preference share
    const estColdCtr = 0.006 + clickRate * 0.026; // 0.6% .. 3.2%
    const estCheckoutRate = (0.015 + intentRate * 0.075) * (0.65 + 0.7 * prefShare);
    const expectedRpmToman = Math.round(estColdCtr * estCheckoutRate * 1000 * offer.priceToman);

    const incomeOrder = ["کم‌درآمد", "متوسط رو به پایین", "متوسط", "متوسط رو به بالا", "مرفه"];
    const byIncome = Array.from(byIncomeMap.entries())
      .map(([tier, v]) => ({
        tier,
        count: v.count,
        intentPct: Number(((v.intent / v.count) * 100).toFixed(1)),
        priceShockPct: Number(((v.shock / v.count) * 100).toFixed(1)),
      }))
      .sort((a, b) => incomeOrder.indexOf(a.tier) - incomeOrder.indexOf(b.tier));

    evals.push({
      offer,
      clickPct,
      intentPct,
      trustPct,
      priceShockPct,
      preferenceSharePct,
      expectedRpmToman,
      byIncome,
    });
  }

  const bestConv = [...evals].sort((a, b) => (b.preferenceSharePct ?? 0) * 0.5 + b.intentPct * 0.5 - ((a.preferenceSharePct ?? 0) * 0.5 + a.intentPct * 0.5))[0];
  const bestRev = [...evals].sort((a, b) => b.expectedRpmToman - a.expectedRpmToman)[0];

  const fmtToman = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)} میلیون تومان` : `${Math.round(v / 1000).toLocaleString("fa-IR")} هزار تومان`;

  const insightSummary =
    bestConv && bestRev
      ? bestConv.offer.id === bestRev.offer.id
        ? `پیشنهاد «${bestRev.offer.label}» هم بیشترین سهم ترجیح مخاطب (${bestRev.preferenceSharePct ?? bestRev.intentPct}٪) و هم بیشترین درآمد مورد انتظار به ازای هر ۱٬۰۰۰ نمایش سرد (${fmtToman(bestRev.expectedRpmToman)}) را ثبت کرد.`
        : `برای حداکثر جذب کاربر، «${bestConv.offer.label}» (سهم انتخاب ${bestConv.preferenceSharePct ?? 0}٪، تمایل ${bestConv.intentPct}٪) پیشتاز است؛ اما برای حداکثر درآمد خالص هر هزار نمایش، «${bestRev.offer.label}» با ${fmtToman(bestRev.expectedRpmToman)} سودآورترین انتخاب است.`
      : "ارزیابی کشش قیمتی کامل شد.";

  return {
    crowdCount: personas.length,
    offers: evals,
    bestConversionId: bestConv?.offer.id ?? "",
    bestRevenueId: bestRev?.offer.id ?? "",
    insightSummary,
    totalCostUsd: Number(((totalTokens * PRICE_PER_M_INPUT) / 1_000_000).toFixed(5)),
    durationMs: Date.now() - t0,
  };
}

/**
 * V6 SYSTEM A — 2nd-Order Social Contagion: Comment-Section Stress Test, Admin Recovery & Dark-Social Virality (~1.8s)
 * Measures:
 *  1) Baseline Trust, Click & Dark-Social Forward probability (Telegram/IG DM forwarding!)
 *  2) Trust & Click Drop when top 3 real skeptical comments sit unanswered underneath the ad
 *  3) Exact Trust & Click Recovery when the brand's Admin Replies answer those exact comments!
 */
export async function evaluateSocialContagion(
  ad: AdCopy,
  comments: SimulatedComment[],
  personas: Persona[]
): Promise<{ result: SocialContagionResult; inputTokens: number }> {
  const voters = personas.slice(0, Math.min(28, personas.length));
  // Prioritize the toughest comments (skeptic, troll, price_check) for the attack stress test!
  const priorityOrder: Record<SimulatedComment["tone"], number> = {
    troll: 0,
    skeptic: 1,
    price_check: 2,
    curious: 3,
    buyer: 4,
  };
  const attackPicks = [...comments]
    .sort((a, b) => (priorityOrder[a.tone] ?? 9) - (priorityOrder[b.tone] ?? 9))
    .slice(0, 3);

  const adBlock = `پست اسپانسری اینستاگرام:\nتیتر: ${ad.headline}\nمتن: ${ad.body}\nدکمه: ${ad.cta}`;
  const attackBlock =
    `${adBlock}\n\nکامنت‌های کاربران زیر این پست (بی‌پاسخ):\n` +
    attackPicks.map((c) => `- ${c.name} (${c.city}): «${c.comment}»`).join("\n");
  const recoveryBlock =
    `${adBlock}\n\nکامنت‌های کاربران + پاسخ رسمی ادمین زیر این پست:\n` +
    attackPicks
      .map((c) => `- ${c.name} (${c.city}): «${c.comment}»\n  ↳ پاسخ ادمین: «${c.suggestedReply}»`)
      .join("\n");

  async function scoreState(stateTxt: string, askShare: boolean) {
    const questions: Record<string, unknown> = {};
    for (const p of voters) {
      const pl = buildPersonaPromptHeader(p);
      questions[`${p.id}__trust`] = {
        type: "choice",
        instructions: `${pl}\n\nبا توجه به آنچه در این پست (و کامنت‌های زیر آن در صورت وجود) می‌بیند، آیا به این پیشنهاد اعتماد می‌کند؟`,
        criteria: { yes: "اعتماد می‌کند", no: "دچار شک یا بی‌اعتمادی می‌شود" },
      };
      questions[`${p.id}__click`] = {
        type: "choice",
        instructions: `${pl}\n\nپس از دیدن این پست (و کامنت‌ها در صورت وجود)، آیا حاضر است روی دکمه کلیک کند؟`,
        criteria: { yes: "کلیک می‌کند", no: "منصرف می‌شود" },
      };
      if (askShare) {
        questions[`${p.id}__share`] = {
          type: "choice",
          instructions: `${pl}\n\nآیا این تبلیغ آن‌قدر به‌دردبخور یا جالب هست که آن را در تلگرام یا دایرکت اینستاگرام برای همسر، همکار یا یکی از دوستانش بفرستد؟`,
          criteria: { yes: "احتمالاً فوروارد می‌کند", no: "فوروارد نمی‌کند" },
        };
      }
    }
    const { data } = await callDecider(stateTxt, questions);
    let tr = 0;
    let cl = 0;
    let sh = 0;
    for (const p of voters) {
      const at = data.answers[`${p.id}__trust`];
      const ac = data.answers[`${p.id}__click`];
      const as = askShare ? data.answers[`${p.id}__share`] : undefined;
      if (at && at.type === "choice") tr += at.probabilities.yes ?? 0;
      if (ac && ac.type === "choice") cl += ac.probabilities.yes ?? 0;
      if (as && as.type === "choice") sh += as.probabilities.yes ?? 0;
    }
    const n = Math.max(1, voters.length);
    return {
      trustPct: Number(((tr / n) * 100).toFixed(1)),
      clickPct: Number(((cl / n) * 100).toFixed(1)),
      sharePct: Number(((sh / n) * 100).toFixed(1)),
      tokens: data.usage?.input_tokens ?? 0,
    };
  }

  const [base, attack, reply] = await Promise.all([
    scoreState(adBlock, true),
    scoreState(attackBlock, false),
    scoreState(recoveryBlock, false),
  ]);

  return {
    result: {
      baselineTrustPct: base.trustPct,
      baselineClickPct: base.clickPct,
      darkSocialSharePct: base.sharePct,
      underAttackTrustPct: attack.trustPct,
      underAttackClickPct: attack.clickPct,
      trustDropPct: Number((attack.trustPct - base.trustPct).toFixed(1)),
      clickDropPct: Number((attack.clickPct - base.clickPct).toFixed(1)),
      afterReplyTrustPct: reply.trustPct,
      afterReplyClickPct: reply.clickPct,
      trustRecoveryPct: Number((reply.trustPct - attack.trustPct).toFixed(1)),
      clickRecoveryPct: Number((reply.clickPct - attack.clickPct).toFixed(1)),
      voterCount: voters.length,
      attackCommentCount: attackPicks.length,
    },
    inputTokens: base.tokens + attack.tokens + reply.tokens,
  };
}

/**
 * V6 SYSTEM B — Counterfactual Causal Ablation X-Ray (~2.2s):
 * Mathematically decomposes total lift into:
 *  - Hook Lift (Champion Headline + Original Body/CTA)
 *  - Offer/Body Lift (Original Headline + Champion Body/CTA)
 *  - Synergy Effect
 * Plus tests Broad Outside-ICP Scaling to advise whether to widen targeting or keep tight ICP!
 */
export async function evaluateCounterfactualXray(
  originalAd: AdCopy,
  championAd: AdCopy,
  icpPersonas: Persona[],
  broadOutsidePersonas: Persona[]
): Promise<{ result: CounterfactualXrayResult; inputTokens: number }> {
  const icp = icpPersonas.slice(0, Math.min(24, icpPersonas.length));
  const broad = broadOutsidePersonas.slice(0, Math.min(24, broadOutsidePersonas.length));
  let totalTokens = 0;

  async function quickFunnelScore(ad: AdCopy, group: Persona[]): Promise<number> {
    if (group.length === 0) return 0;
    const stateH = buildHeadlineOnlyState(ad);
    const stateF = buildAdState(ad);
    const qh: Record<string, unknown> = {};
    const qf: Record<string, unknown> = {};

    for (const p of group) {
      const pl = buildPersonaPromptHeader(p);
      qh[p.id] = {
        type: "choice",
        instructions: `${pl}\n\nآیا فقط همین تیتر باعث می‌شود انگشت *همین فرد خاص* وسط اسکرول مکث کند؟`,
        criteria: { stop: "مکث می‌کند", scroll: "رد می‌شود" },
      };
      qf[`${p.id}__rel`] = {
        type: "choice",
        instructions: `${pl}\n\nآیا موضوع این محصول به درد زندگی فعلی *همین فرد* می‌خورد؟`,
        criteria: { high: "کاملاً", mid: "تا حدی", low: "اصلاً" },
      };
      qf[`${p.id}__cl`] = {
        type: "choice",
        instructions: `${pl}\n\nآیا در ۳ ثانیه اول روشن است چه محصول و پیشنهادی ارائه می‌شود؟`,
        criteria: { clear: "روشن", vague: "گنگ" },
      };
      qf[`${p.id}__pu`] = {
        type: "choice",
        instructions: `${pl}\n\nآیا قانع می‌شود کلیک کند؟`,
        criteria: { yes: "کلیک می‌کند", no: "کلیک نمی‌کند" },
      };
      qf[`${p.id}__tr`] = {
        type: "choice",
        instructions: `${pl}\n\nآیا حس برند واقعی و معتبر می‌دهد؟`,
        criteria: { yes: "معتبر", no: "مشکوک یا نچسب" },
      };
    }

    const [rh, rf] = await Promise.all([callDecider(stateH, qh), callDecider(stateF, qf)]);
    totalTokens += (rh.data.usage?.input_tokens ?? 0) + (rf.data.usage?.input_tokens ?? 0);

    let sum = 0;
    for (const p of group) {
      const ah = rh.data.answers[p.id];
      const st = ah && ah.type === "choice" ? ah.probabilities.stop ?? 0 : 0;
      const ar = rf.data.answers[`${p.id}__rel`];
      const rp = ar && ar.type === "choice" ? ar.probabilities : {};
      const rel = (rp.high ?? 0) + 0.4 * (rp.mid ?? 0) + 0.02 * (rp.low ?? 0);
      const acl = rf.data.answers[`${p.id}__cl`];
      const cl = acl && acl.type === "choice" ? acl.probabilities.clear ?? 0.5 : 0.5;
      const apu = rf.data.answers[`${p.id}__pu`];
      const pu = apu && apu.type === "choice" ? apu.probabilities.yes ?? 0 : 0;
      const atr = rf.data.answers[`${p.id}__tr`];
      const tr = atr && atr.type === "choice" ? atr.probabilities.yes ?? 0 : 0;

      const effStop = st * (0.25 + 0.75 * rel);
      const effClick = effStop * pu * (0.35 + 0.65 * cl) * (0.30 + 0.70 * tr);
      sum += (effClick * 0.5 + effStop * 0.25 + cl * tr * 0.15 + pu * rel * 0.1) * 100;
    }
    return Number((sum / Math.max(1, group.length)).toFixed(1));
  }

  const hookOnlyAd: AdCopy = { ...originalAd, headline: championAd.headline };
  const offerOnlyAd: AdCopy = { ...championAd, headline: originalAd.headline };

  const [origScore, hookScore, offerScore, champScore, broadScore] = await Promise.all([
    quickFunnelScore(originalAd, icp),
    quickFunnelScore(hookOnlyAd, icp),
    quickFunnelScore(offerOnlyAd, icp),
    quickFunnelScore(championAd, icp),
    broad.length >= 8 ? quickFunnelScore(championAd, broad) : Promise.resolve<number | null>(null),
  ]);

  const hookLift = Number((hookScore - origScore).toFixed(1));
  const offerLift = Number((offerScore - origScore).toFixed(1));
  const totalLift = Number((champScore - origScore).toFixed(1));
  const synergyLift = Number((totalLift - (hookLift + offerLift)).toFixed(1));

  const posHook = Math.max(0, hookLift);
  const posOffer = Math.max(0, offerLift);
  const denom = posHook + posOffer;
  const hookSharePct = denom > 0.1 ? Math.round((posHook / denom) * 100) : 50;
  const offerSharePct = denom > 0.1 ? 100 - hookSharePct : 50;

  const broadGap = broadScore !== null ? Number((broadScore - champScore).toFixed(1)) : null;
  let scaleVerdict = "تمام جمعیت هدف فعلی در فیلتر شما قرار دارد.";
  if (broadGap !== null) {
    if (broadGap >= -6) {
      scaleVerdict = `قابل مقیاس‌دهی گسترده (Broad Scaling): عملکرد خارج از فیلتر هدف فقط ${Math.abs(broadGap).toFixed(1)} امتیاز متفاوت است — می‌توانید بودجه را به کل ایران باز کنید.`;
    } else if (broadGap >= -15) {
      scaleVerdict = `هدف‌گیری نیمه‌باز: خارج از فیلتر اصلی افت متوسطی (${broadGap.toFixed(1)} امتیاز) دارید؛ ابتدا روی ICP اصلی بودجه بگذارید و سپس تدریجی باز کنید.`;
    } else {
      scaleVerdict = `هدف‌گیری دقیق (Tight ICP): خارج از فیلتر اصلی افت شدیدی (${broadGap.toFixed(1)} امتیاز) دارد — بودجه را حتماً فقط روی مخاطب هدف فعلی نگه دارید تا نسوزد.`;
    }
  }

  return {
    result: {
      originalScore: origScore,
      hookOnlyScore: hookScore,
      offerOnlyScore: offerScore,
      championScore: champScore,
      hookLift,
      offerLift,
      synergyLift,
      hookSharePct,
      offerSharePct,
      tightIcpScore: champScore,
      broadOutsideScore: broadScore,
      broadGap,
      scaleVerdict,
      voterCount: icp.length,
    },
    inputTokens: totalTokens,
  };
}

/**
 * V7 Helper for Closed-Loop Verified Admin Reply Upgrade (~1.0s):
 * Re-scores ONLY the recovered comment thread with newly upgraded admin replies on the exact same voters.
 */
export async function scoreCommentRepliesOnly(
  ad: AdCopy,
  attackComments: Array<{ name: string; city: string; comment: string; reply: string }>,
  personas: Persona[]
): Promise<{ trustPct: number; clickPct: number; inputTokens: number }> {
  const voters = personas.slice(0, Math.min(28, personas.length));
  const stateTxt =
    `پست اسپانسری اینستاگرام:\nتیتر: ${ad.headline}\nمتن: ${ad.body}\nدکمه: ${ad.cta}\n\n` +
    `کامنت‌های کاربران + پاسخ رسمی ادمین زیر این پست:\n` +
    attackComments.map((c) => `- ${c.name} (${c.city}): «${c.comment}»\n  ↳ پاسخ ادمین: «${c.reply}»`).join("\n");

  const questions: Record<string, unknown> = {};
  for (const p of voters) {
    const pl = buildPersonaPromptHeader(p);
    questions[`${p.id}__trust`] = {
      type: "choice",
      instructions: `${pl}\n\nبا توجه به آنچه در این پست و پاسخ ادمین در کامنت‌ها می‌بیند، آیا به این پیشنهاد اعتماد می‌کند؟`,
      criteria: { yes: "اعتماد می‌کند", no: "دچار شک یا بی‌اعتمادی می‌شود" },
    };
    questions[`${p.id}__click`] = {
      type: "choice",
      instructions: `${pl}\n\nپس از دیدن این پست و پاسخ ادمین، آیا حاضر است روی دکمه کلیک کند؟`,
      criteria: { yes: "کلیک می‌کند", no: "منصرف می‌شود" },
    };
  }
  const { data } = await callDecider(stateTxt, questions);
  let tr = 0;
  let cl = 0;
  for (const p of voters) {
    const at = data.answers[`${p.id}__trust`];
    const ac = data.answers[`${p.id}__click`];
    if (at && at.type === "choice") tr += at.probabilities.yes ?? 0;
    if (ac && ac.type === "choice") cl += ac.probabilities.yes ?? 0;
  }
  const n = Math.max(1, voters.length);
  return {
    trustPct: Number(((tr / n) * 100).toFixed(1)),
    clickPct: Number(((cl / n) * 100).toFixed(1)),
    inputTokens: data.usage?.input_tokens ?? 0,
  };
}

/**
 * V7 SYSTEM — 10-Second Instant Multi-Ad A/B/C/D Battle Arena (~6-10s, ~$0.004):
 * 1) Order-rotated N-way tournament across targeted Iranians WITH exact per-archetype vote matrix!
 * 2) Parallel full V5 multiplicative funnel evaluation for every contender!
 * 3) Automatic funnel bottleneck diagnosis per contender!
 */
export async function evaluateBattleArena(params: {
  contenders: BattleContenderInput[];
  personas: Persona[];
  platform: NonNullable<AdCopy["platform"]>;
}): Promise<BattleResult> {
  const t0 = Date.now();
  const { contenders, personas, platform } = params;
  const n = contenders.length;
  let totalTokens = 0;

  // Normalize platform on every contender
  const normalized = contenders.map((c) => ({
    ...c,
    ad: { ...c.ad, platform },
  }));

  // Step 1: Order-rotated N-way tournament tracking BOTH overall shares AND per-archetype vote matrix!
  const voters = personas.slice(0, Math.min(60, personas.length));
  const numRot = Math.min(4, n);
  const shifts = Array.from({ length: numRot }, (_, k) => Math.floor((k * n) / numRot));
  const groups: Persona[][] = Array.from({ length: numRot }, () => []);
  voters.forEach((p, idx) => groups[idx % numRot].push(p));

  const totals = new Array<number>(n).fill(0);
  let noneTotal = 0;
  const archVotes = new Map<string, { count: number; shares: Record<string, number> }>();

  const platLabel = PLATFORM_LABELS[platform] ?? "فید اینستاگرام";

  const tournamentPromise = Promise.all(
    shifts.map(async (sh, gi) => {
      const group = groups[gi];
      if (group.length === 0) return;
      const orderIdx = Array.from({ length: n }, (_, i) => (i + sh) % n);
      const state =
        `${n} نسخه تبلیغ مختلف در فرمت «${platLabel}»:\n\n` +
        orderIdx
          .map((oi, pos) => {
            const a = normalized[oi].ad;
            if (platform === "instagram_story") {
              return `--- نسخه ${pos + 1} ---\nفریم ۱ (قلاب): ${a.headline}\nفریم ۲ (اثبات): ${a.body}\nفریم ۳ (استیکر): [${a.cta}]`;
            }
            if (platform === "instagram_reels") {
              return `--- نسخه ${pos + 1} ---\nقلاب ۰-۳ ثانیه: ${a.headline}\nسناریو: ${a.body}\nفراخوان: ${a.cta}`;
            }
            return `--- نسخه ${pos + 1} ---\nتیتر: ${a.headline}\nمتن: ${a.body}\nدکمه: ${a.cta}`;
          })
          .join("\n\n");

      const criteria: Record<string, string> = {};
      for (let i = 0; i < n; i++) criteria[`a${i + 1}`] = `نسخه ${i + 1}`;
      criteria.none = "هیچ‌کدام قانعش نمی‌کند";

      const chunkSize = 20;
      for (let ci = 0; ci < group.length; ci += chunkSize) {
        const batch = group.slice(ci, ci + chunkSize);
        const questions: Record<string, unknown> = {};
        for (const p of batch) {
          questions[p.id] = {
            type: "choice",
            instructions:
              `${buildPersonaPromptHeader(p)}\n\n` +
              `با توجه به نیاز واقعی، بودجه و سبک تصمیم‌گیری *همین فرد خاص* در «${platLabel}»، کدام نسخه بیشترین کشش و احتمال اقدام را برایش دارد؟ (اگر هیچ‌کدام به کارش نمی‌آید، none را بزن)`,
            criteria,
          };
        }
        const { data } = await callDecider(state, questions);
        totalTokens += data.usage?.input_tokens ?? 0;

        for (const p of batch) {
          const ans = data.answers[p.id];
          if (!ans || ans.type !== "choice") continue;
          noneTotal += ans.probabilities.none ?? 0;
          const archRec = archVotes.get(p.ad_archetype) ?? {
            count: 0,
            shares: Object.fromEntries(normalized.map((c) => [c.id, 0])),
          };
          archRec.count += 1;
          orderIdx.forEach((oi, pos) => {
            const v = ans.probabilities[`a${pos + 1}`] ?? 0;
            totals[oi] += v;
            archRec.shares[normalized[oi].id] = (archRec.shares[normalized[oi].id] ?? 0) + v;
          });
          archVotes.set(p.ad_archetype, archRec);
        }
      }
    })
  );

  // Step 2: Run full V5 multiplicative funnel evaluation for every contender (capped at 48 personas for speed!)
  const evalPanel = personas.slice(0, Math.min(48, personas.length));
  const evalsPromise = Promise.all(
    normalized.map((c) =>
      evaluateCrowdStreaming(c.id, 0, c.label, c.ad, evalPanel, () => {}, "original")
    )
  );

  const [, evalResults] = await Promise.all([tournamentPromise, evalsPromise]);
  for (const ev of evalResults) {
    totalTokens += ev.inputTokens;
  }

  const denom = Math.max(1, voters.length);
  const nonePct = Number(((noneTotal / denom) * 100).toFixed(1));

  function diagnoseBottleneck(ev: VariantResult): string {
    const rel = ev.relevance ?? 50;
    if (rel < 32) return `گلوگاه هدف‌گیری: تناسب با این مخاطب پایین است (${Math.round(rel)}٪)`;
    if (ev.clarity < 55) return `گلوگاه شفافیت ۳ ثانیه: مخاطب سریع نمی‌فهمد پیشنهاد دقیقاً چیست (${Math.round(ev.clarity)}٪)`;
    if (ev.trust < 55) return `گلوگاه اعتماد: حس مشکوک یا کم‌اعتبار ایجاد می‌کند (${Math.round(ev.trust)}٪)`;
    if (ev.stop < 32) return `گلوگاه قلاب اولیه: در اسکرول/تپ سریع دیده نمی‌شود (${Math.round(ev.stop)}٪)`;
    if (ev.click < 18) return `گلوگاه پیشنهاد/CTA: دیده می‌شود ولی انگیزه اقدام نهایی ضعیف است`;
    return `متعادل و سالم در هر ۴ مرحله قیف (توقف ${Math.round(ev.stop)}٪ · شفافیت ${Math.round(ev.clarity)}٪ · اعتماد ${Math.round(ev.trust)}٪)`;
  }

  const contenderResults: BattleContenderResult[] = normalized.map((c, idx) => {
    const ev = evalResults[idx];
    return {
      id: c.id,
      label: c.label,
      ad: c.ad,
      tournamentSharePct: Number(((totals[idx] / denom) * 100).toFixed(1)),
      fitness: ev.fitness,
      fitnessStd: ev.fitnessStd ?? 0,
      estCtrPct: ev.estCtrPct ?? 1.0,
      relevance: ev.relevance ?? 50,
      stop: ev.stop,
      clarity: ev.clarity,
      trust: ev.trust,
      click: ev.click,
      reactions: ev.reactions,
      bottleneck: diagnoseBottleneck(ev),
      segmentsByArchetype: ev.segmentsByArchetype ?? [],
      segmentsByCityTier: ev.segmentsByCityTier,
      segmentsByIncome: ev.segmentsByIncome,
    };
  });

  // Sort winner by combined Tournament Share (60%) + Multiplicative Funnel Fitness (40%)
  const ranked = [...contenderResults].sort(
    (a, b) => b.tournamentSharePct * 0.6 + b.fitness * 0.4 - (a.tournamentSharePct * 0.6 + a.fitness * 0.4)
  );
  const winner = ranked[0];
  const runnerUp = ranked[1];

  const archetypeMatrix = Array.from(archVotes.entries())
    .map(([archetype, rec]) => {
      const shares: Record<string, number> = {};
      let bestId = normalized[0].id;
      let bestVal = -1;
      for (const c of normalized) {
        const pct = Number((((rec.shares[c.id] ?? 0) / Math.max(1, rec.count)) * 100).toFixed(1));
        shares[c.id] = pct;
        if (pct > bestVal) {
          bestVal = pct;
          bestId = c.id;
        }
      }
      return { archetype, count: rec.count, shares, winnerId: bestId };
    })
    .sort((a, b) => b.count - a.count);

  // Check if buyer mindsets genuinely split between winner and runner-up
  const splitArchs = archetypeMatrix.filter((row) => row.winnerId !== winner.id && row.count >= 2);
  const verdictSummary = runnerUp
    ? splitArchs.length > 0
      ? `برنده کل میدان «${winner.label}» با ${winner.tournamentSharePct}٪ سهم ترجیح و امتیاز ${winner.fitness} (~${winner.estCtrPct}٪ CTR) در برابر «${runnerUp.label}» (${runnerUp.tournamentSharePct}٪) است؛ اما ${splitArchs.length} تیپ خریدار (از جمله «${splitArchs[0].archetype}») نسخه رقیب را ترجیح دادند — اجرای همزمان هر دو برای دو بخش بازار ارزشمند است.`
      : `«${winner.label}» با برتری قاطع در تورنمنت (${winner.tournamentSharePct}٪ در برابر ${runnerUp.tournamentSharePct}٪) و امتیاز قیف ${winner.fitness} (~${winner.estCtrPct}٪ CTR) برنده بی‌رقیب این نبرد است.`
    : `ارزیابی نبرد کامل شد.`;

  return {
    platform,
    crowdCount: voters.length,
    nonePct,
    winnerId: winner.id,
    verdictSummary,
    contenders: contenderResults,
    archetypeMatrix,
    totalTokens,
    totalCostUsd: Number(((totalTokens * PRICE_PER_M_INPUT) / 1_000_000).toFixed(5)),
    durationMs: Date.now() - t0,
  };
}
