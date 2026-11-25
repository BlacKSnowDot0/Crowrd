"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  Crosshair,
  ImagePlus,
  Loader2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Swords,
  Trash2,
} from "lucide-react";
import type {
  AdCopy,
  AudienceFilters,
  ClauseHeat,
  CounterfactualXrayResult,
  EvolutionRun,
  EvolveSSEEvent,
  FeedBattleResult,
  FocusGroupQuote,
  FunnelCandidate,
  GenerationDiagnosis,
  HeadToHeadResult,
  HoldoutResult,
  LaunchKit,
  Persona,
  PersonJudgment,
  ReactionCounts,
  ReasoningMode,
  SimulatedComment,
  SocialContagionResult,
  SplitCampaignAdvice,
  VariantResult,
  VoiceRegister,
} from "@/lib/types";
import { AdComparisonCards } from "./AdComparisonCards";
import { CrowdJudgingMatrix } from "./CrowdJudgingMatrix";
import { EvolutionChart } from "./EvolutionChart";
import { PostLaunchPanel } from "./PostLaunchPanel";

interface TestAdStudioProps {
  allPersonas: Persona[];
  loadedRun: EvolutionRun | null;
  onClearLoadedRun: () => void;
  onRunSaved: () => void;
  onOpenInterview: (personaId: string, judgment?: PersonJudgment, ad?: AdCopy) => void;
}

interface Preset {
  id: string;
  label: string;
  category: string;
  ad: AdCopy;
  productTruth: string;
}

const PRESETS: Preset[] = [
  {
    id: "fityar",
    label: "اپلیکیشن تمرین خانگی «فیت‌یار»",
    category: "اپلیکیشن · ورزش",
    ad: {
      headline: "سال جدید، همون آدم قبلی؟ این بار نه!",
      body: "فیت‌یار برات برنامه می‌سازه، با دوربین گوشی تعداد حرکت‌هات رو می‌شماره و اونقدر پیگیرت میشه تا ورزش کنی. روزی ۱۵ دقیقه بدون نیاز به باشگاه. ۷۲٪ اعضا تا ماه سوم همچنان ادامه میدن.",
      cta: "ماه اول فقط ۴۹ هزار تومان — فقط تا یکشنبه",
      platform: "instagram_reels",
    },
    productTruth:
      "- اپلیکیشن ایرانی تمرین خانگی ۱۵ دقیقه‌ای بدون نیاز به باشگاه و تجهیزات\n- طراحی برنامه شخصی‌سازی‌شده زیر نظر مربیان دارای مدرک\n- شمارش حرکت با دوربین کاملاً اختیاری است و پردازش ۱۰۰٪ روی خود گوشی انجام می‌شود (بدون ارسال یا ذخیره فیلم)\n- بدون نیاز به فیلترشکن، قابل اجرا روی اندروید و iOS، دارای اینماد و امتیاز ۴.۷ در کافه‌بازار\n- قیمت شفاف: ۷ روز تست کاملاً رایگان بدون نیاز به کارت بانکی، ماه اول ۴۹ هزار تومان و از ماه دوم ۱۴۹ هزار تومان (لغو آنی با یک کلیک)",
  },
  {
    id: "noraplus",
    label: "سرم ویتامین C «نوراپلاس»",
    category: "زیبایی · پر از خطای اعتماد",
    ad: {
      headline: "حراج شوکه‌کننده ۹۰٪ سرم ویتامین C فقط تا امشب!",
      body: "فقط تا پایان امشب ۹۰٪ تخفیف استثنایی روی تمام محصولات داریم و بعد از امشب قیمت‌ها ۳ برابر می‌شود! محصول دارای تاییدیه سازمان غذا و دارو است. به دلیل فروش فوق‌العاده، ثبت سفارش فقط کارت‌به‌کارت است و امکان مرجوعی وجود ندارد.",
      cta: "همین الان کارت‌به‌کارت کن قبل از اتمام موجودی",
      platform: "instagram_story",
    },
    productTruth:
      "- سرم ویتامین C و ضدآفتاب ایرانی «نوراپلاس» با تاییدیه رسمی سازمان غذا و دارو و سیب سلامت\n- قیمت واقعی با تخفیف واقعی ۲۵٪: ۴۹۰ هزار تومان (به‌جای ۶۵۰ هزار تومان)\n- دارای اینماد و بیش از ۱۲ هزار نظر تاییدشده در دیجی‌کالا\n- پرداخت امن آنلاین از درگاه بانکی + پرداخت ۴ قسطه بدون سود با اسنپ‌پی\n- ارسال رایگان با تیپاکس به سراسر ایران + ضمانت ۷ روزه بازگشت وجه در صورت عدم رضایت",
  },
  {
    id: "kifyar",
    label: "اپ مدیریت مالی «کیف‌یار»",
    category: "فین‌تک · اشتراک",
    ad: {
      headline: "دیگه هیچ‌وقت آخر ماه تعجب نکن پولت کجا رفت!",
      body: "کیف‌یار به پیامک‌های بانکی تو وصل میشه و همه‌ی خرج‌هات رو خودکار دسته‌بندی می‌کنه. گزارش سود و زیان لحظه‌ای و تفکیک حساب شخصی و کاری. اشتراک ماهانه ۳۹۰ هزار تومان.",
      cta: "خرید اشتراک ماهانه ۳۹۰ هزار تومانی",
      platform: "telegram",
    },
    productTruth:
      "- اپلیکیشن ایرانی حسابداری شخصی و کاری با پردازش امن و آفلاین پیامک‌های بانکی روی خود گوشی (هیچ پیامکی به سرور خارجی ارسال نمی‌شود)\n- تفکیک هوشمند تراکنش‌های شخصی و کاری (مناسب فریلنسرها و آنلاین‌شاپ‌ها)\n- دارای اینماد و مجوز دانش‌بنیان\n- نسخه پایه کاملاً رایگان + نسخه حرفه‌ای ۱۴ روز تست رایگان بدون کارت، سپس ۱۹۰ هزار تومان ماهانه یا اقساطی سالانه",
  },
  {
    id: "coffee",
    label: "قهوه تخصصی «نورا»",
    category: "ای‌کامرس · لحن برند",
    ad: {
      headline: "بهترین و خوشمزه‌ترین قهوه دنیا رسید! باورنکردنی!",
      body: "اگر دنبال یه قهوه فوق‌العاده هستی که همه رو شگفت‌زده کنه همین الان سفارش بده! بسته ۲۵۰ گرمی ۶۸۰ هزار تومان. موجودی به شدت محدود!",
      cta: "سفارش سریع",
      platform: "instagram_story",
    },
    productTruth:
      "- دانه ۱۰۰٪ عربیکا اتیوپی، رُست مدیوم تازه (حداکثر ۴۸ ساعت قبل از ارسال، تاریخ رُست حک‌شده روی بسته)\n- قیمت شفاف بسته ۲۵۰ گرمی ۴۸۰ هزار تومان + پک تست ۱۰۰ گرمی ۱۹۵ هزار تومان\n- ارسال رایگان برای سفارش‌های بالای ۲ بسته + پرداخت ۴ قسطه اسنپ‌پی\n- دارای اینماد و ضمانت تعویض در صورت عدم تازگی",
  },
];

const CITY_TIERS = ["تهران", "کلان‌شهر", "مرکز استان", "شهرستان"];
const INCOME_TIERS = ["کم‌درآمد", "متوسط رو به پایین", "متوسط", "متوسط رو به بالا", "مرفه"];

const VOICE_REGISTERS: Array<{ key: VoiceRegister; label: string; hint: string }> = [
  { key: "colloquial", label: "محاوره‌ای طبیعی", hint: "مثل: بیرون نمیره، بانکیت، می‌شی" },
  { key: "friendly", label: "صمیمی محترمانه", hint: "با «شما»، گرم و روان" },
  { key: "modern_pro", label: "حرفه‌ای مدرن", hint: "استاندارد معاصر و موجز" },
  { key: "bold_genz", label: "جسورانه جوان", hint: "تند، صریح و اینستاگرامی" },
];

async function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1024;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("تصویر نامعتبر است"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("خطا در خواندن فایل"));
    reader.readAsDataURL(file);
  });
}

export function TestAdStudio({
  allPersonas,
  loadedRun,
  onClearLoadedRun,
  onRunSaved,
  onOpenInterview,
}: TestAdStudioProps) {
  const [ad, setAd] = useState<AdCopy>(PRESETS[0].ad);
  const [productTruth, setProductTruth] = useState<string>(PRESETS[0].productTruth);
  const [voiceRegister, setVoiceRegister] = useState<VoiceRegister>("colloquial");
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>("max");
  const [competitorContext, setCompetitorContext] = useState<string>("");
  const [enableFeedBattle, setEnableFeedBattle] = useState<boolean>(true);
  const [filters, setFilters] = useState<AudienceFilters>({ gender: "all" });
  const [showFilters, setShowFilters] = useState(false);
  const [icpLoading, setIcpLoading] = useState(false);
  const [icpNote, setIcpNote] = useState<{ label: string; rationale: string } | null>(null);
  const [crowdSize, setCrowdSize] = useState<number>(60);
  const [holdoutSize, setHoldoutSize] = useState<number>(48);
  const [generations, setGenerations] = useState<number>(3);
  const [variantsPerGen, setVariantsPerGen] = useState<number>(2);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<
    | "idle"
    | "orig"
    | "creative_room"
    | "copy_chief"
    | "funnel_screen"
    | "focus_group"
    | "mutating"
    | "judging"
    | "duel"
    | "holdout_orig"
    | "holdout_champ"
    | "feed_battle"
    | "done"
  >("idle");
  const [activeGen, setActiveGen] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [activeVariantLabel, setActiveVariantLabel] = useState("");
  const [trainTotal, setTrainTotal] = useState(0);
  const [holdoutTotal, setHoldoutTotal] = useState(0);

  const [liveExpected, setLiveExpected] = useState(0);
  const [liveJudgments, setLiveJudgments] = useState<PersonJudgment[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<{
    fitness: number;
    stop: number;
    click: number;
    intent: number;
    trust: number;
    naturalness?: number;
    clarity: number;
    reactions: ReactionCounts;
  } | null>(null);
  const [liveAdForInterview, setLiveAdForInterview] = useState<AdCopy>(PRESETS[0].ad);

  const [original, setOriginal] = useState<VariantResult | null>(null);
  const [champion, setChampion] = useState<VariantResult | null>(null);
  const [variants, setVariants] = useState<VariantResult[]>([]);
  const [diagnoses, setDiagnoses] = useState<GenerationDiagnosis[]>([]);
  const [liveFocusQuotes, setLiveFocusQuotes] = useState<Record<number, FocusGroupQuote[]>>({});
  const [funnelCandidates, setFunnelCandidates] = useState<FunnelCandidate[] | undefined>(undefined);
  const [headToHead, setHeadToHead] = useState<HeadToHeadResult[]>([]);
  const [splitAdvice, setSplitAdvice] = useState<SplitCampaignAdvice | undefined>(undefined);
  const [championHistory, setChampionHistory] = useState<EvolutionRun["championHistory"]>([]);
  const [holdout, setHoldout] = useState<HoldoutResult | undefined>(undefined);
  const [feedBattle, setFeedBattle] = useState<FeedBattleResult | undefined>(undefined);
  const [simulatedComments, setSimulatedComments] = useState<SimulatedComment[] | undefined>(undefined);
  const [socialContagion, setSocialContagion] = useState<SocialContagionResult | undefined>(undefined);
  const [counterfactualXray, setCounterfactualXray] = useState<CounterfactualXrayResult | undefined>(undefined);
  const [launchKit, setLaunchKit] = useState<LaunchKit | undefined>(undefined);
  const [loadedCommentsOverride, setLoadedCommentsOverride] = useState<Record<string, SimulatedComment[]>>({});
  const [loadedKitOverride, setLoadedKitOverride] = useState<Record<string, LaunchKit>>({});
  const [completedRun, setCompletedRun] = useState<EvolutionRun | null>(null);
  const [inspectedVariantId, setInspectedVariantId] = useState<string | null>(null);

  const customTags = useMemo(() => {
    const s = new Set<string>();
    for (const p of allPersonas) if (p.custom_tag) s.add(p.custom_tag);
    return Array.from(s);
  }, [allPersonas]);

  const availableSectors = useMemo(() => {
    return Array.from(new Set(allPersonas.map((p) => p.sector))).sort();
  }, [allPersonas]);

  const hasActiveFilters = Boolean(
    filters.cityTiers?.length ||
      filters.incomeTiers?.length ||
      filters.sectors?.length ||
      (filters.gender && filters.gender !== "all") ||
      filters.minAge ||
      filters.maxAge ||
      (filters.customTag && filters.customTag !== "all")
  );

  const matchedCount = useMemo(() => {
    return allPersonas.filter((p) => {
      if (filters.cityTiers?.length && !filters.cityTiers.includes(p.city_tier)) return false;
      if (filters.incomeTiers?.length && !filters.incomeTiers.includes(p.income_tier)) return false;
      if (filters.sectors?.length && !filters.sectors.includes(p.sector)) return false;
      if (filters.gender && filters.gender !== "all" && p.gender !== filters.gender) return false;
      if (filters.minAge && p.age < filters.minAge) return false;
      if (filters.maxAge && p.age > filters.maxAge) return false;
      if (filters.customTag && filters.customTag !== "all" && p.custom_tag !== filters.customTag) return false;
      return true;
    }).length;
  }, [allPersonas, filters]);

  const displayRun = loadedRun ?? completedRun;
  const displayOriginal = loadedRun ? loadedRun.original : original;
  const displayChampion = loadedRun ? loadedRun.champion : champion;
  const displayVariants = loadedRun ? loadedRun.variants : variants;
  const displayDiagnoses = loadedRun ? loadedRun.diagnoses : diagnoses;
  const displayFunnel = loadedRun ? loadedRun.funnelCandidates : funnelCandidates;
  const displayHistory = loadedRun ? loadedRun.championHistory : championHistory;
  const displayHeadToHead = loadedRun ? loadedRun.headToHead ?? [] : headToHead;
  const displaySplitAdvice = loadedRun ? loadedRun.splitAdvice : splitAdvice;
  const displayHoldout = loadedRun ? loadedRun.holdout : holdout;
  const displayFeedBattle = loadedRun ? loadedRun.feedBattle : feedBattle;
  const displaySocialContagion = loadedRun ? loadedRun.socialContagion : socialContagion;
  const displayCounterfactualXray = loadedRun ? loadedRun.counterfactualXray : counterfactualXray;
  const displayComments = loadedRun
    ? loadedCommentsOverride[loadedRun.id] ?? loadedRun.simulatedComments
    : simulatedComments;
  const displayLaunchKit = loadedRun
    ? loadedKitOverride[loadedRun.id] ?? loadedRun.launchKit
    : launchKit;
  const displayGens = loadedRun ? loadedRun.generationsRequested : generations;

  const inspectedVariant = useMemo(() => {
    if (isRunning) return null;
    if (inspectedVariantId === "holdout_orig" && displayHoldout) return displayHoldout.original;
    if (inspectedVariantId === "holdout_champ" && displayHoldout) return displayHoldout.champion;
    if (inspectedVariantId) {
      return displayVariants.find((v) => v.id === inspectedVariantId) ?? displayChampion;
    }
    return displayChampion;
  }, [isRunning, inspectedVariantId, displayVariants, displayChampion, displayHoldout]);

  const matrixJudgments = isRunning ? liveJudgments : inspectedVariant?.judgments ?? [];
  const matrixExpected = isRunning ? liveExpected : inspectedVariant?.judgments.length ?? 0;
  const matrixMetrics = isRunning
    ? liveMetrics
    : inspectedVariant
      ? {
          fitness: inspectedVariant.fitness,
          stop: inspectedVariant.stop,
          click: inspectedVariant.click,
          intent: inspectedVariant.intent,
          trust: inspectedVariant.trust,
          naturalness: inspectedVariant.naturalness,
          clarity: inspectedVariant.clarity,
          reactions: inspectedVariant.reactions,
        }
      : null;
  const matrixAd = isRunning ? liveAdForInterview : inspectedVariant?.ad ?? ad;

  const toggleFilterItem = (key: "cityTiers" | "incomeTiers" | "sectors", val: string) => {
    setFilters((prev) => {
      const cur = prev[key] ?? [];
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      return { ...prev, [key]: next.length ? next : undefined };
    });
  };

  const handleAutoICP = async () => {
    if (icpLoading) return;
    setError(null);
    setIcpLoading(true);
    try {
      const resp = await fetch("/api/icp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad, productTruth }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "خطا در تشخیص مخاطب هدف");
      setFilters(data.filters ?? { gender: "all" });
      if (data.recommendedRegister) setVoiceRegister(data.recommendedRegister);
      setIcpNote({ label: data.icpLabel, rationale: data.rationale });
      setShowFilters(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در تشخیص مخاطب هدف");
    } finally {
      setIcpLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAd((prev) => ({ ...prev, imageDataUrl: dataUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در پردازش تصویر");
    }
  };

  const resetToComposer = () => {
    onClearLoadedRun();
    setCompletedRun(null);
    setOriginal(null);
    setChampion(null);
    setVariants([]);
    setDiagnoses([]);
    setLiveFocusQuotes({});
    setFunnelCandidates(undefined);
    setHeadToHead([]);
    setSplitAdvice(undefined);
    setChampionHistory([]);
    setHoldout(undefined);
    setFeedBattle(undefined);
    setSimulatedComments(undefined);
    setSocialContagion(undefined);
    setCounterfactualXray(undefined);
    setLaunchKit(undefined);
    setLiveJudgments([]);
    setLiveMetrics(null);
    setCurrentPhase("idle");
    setInspectedVariantId(null);
    setError(null);
  };

  const startEvolution = async () => {
    if (!ad.headline.trim() || !ad.body.trim()) {
      setError("لطفاً تیتر و متن تبلیغ را وارد کنید.");
      return;
    }
    onClearLoadedRun();
    setError(null);
    setIsRunning(true);
    setCompletedRun(null);
    setOriginal(null);
    setChampion(null);
    setVariants([]);
    setDiagnoses([]);
    setLiveFocusQuotes({});
    setFunnelCandidates(undefined);
    setHeadToHead([]);
    setSplitAdvice(undefined);
    setChampionHistory([]);
    setHoldout(undefined);
    setFeedBattle(undefined);
    setSimulatedComments(undefined);
    setSocialContagion(undefined);
    setCounterfactualXray(undefined);
    setLaunchKit(undefined);
    setInspectedVariantId(null);
    setLiveJudgments([]);
    setLiveMetrics(null);
    setLiveAdForInterview({ ...ad, voiceRegister });
    setCurrentPhase("orig");
    setActiveGen(0);
    setStatusMessage("در حال آماده‌سازی جمعیت نمونه...");

    try {
      const resp = await fetch("/api/evolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad: { ...ad, voiceRegister },
          productTruth,
          voiceRegister,
          reasoningMode,
          enableFeedBattle,
          competitorContext,
          filters,
          crowdSize,
          holdoutSize,
          generations,
          variantsPerGen,
        }),
      });
      if (!resp.ok || !resp.body) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const raw of parts) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const ev = JSON.parse(line.slice(5).trim()) as EvolveSSEEvent;

          if (ev.type === "init") {
            setTrainTotal(ev.trainCount);
            setHoldoutTotal(ev.holdoutCount);
            setLiveExpected(ev.trainCount);
          } else if (ev.type === "phase") {
            setCurrentPhase(ev.phase);
            setActiveGen(ev.generation);
            setStatusMessage(ev.message);
            if (ev.variantLabel) setActiveVariantLabel(ev.variantLabel);
            if (
              ev.phase === "orig" ||
              ev.phase === "judging" ||
              ev.phase === "holdout_orig" ||
              ev.phase === "holdout_champ"
            ) {
              setLiveJudgments([]);
              setLiveMetrics(null);
              if (ev.totalToJudge) setLiveExpected(ev.totalToJudge);
            }
          } else if (ev.type === "wave") {
            setLiveJudgments((prev) => [...prev, ...ev.batch]);
            setLiveExpected(ev.total);
            setLiveMetrics(ev.runningMetrics);
          } else if (ev.type === "heatmap") {
            const hm: ClauseHeat[] = ev.heatmap;
            setVariants((prev) => prev.map((v) => (v.id === ev.variantId ? { ...v, heatmap: hm } : v)));
            setOriginal((prev) => (prev && prev.id === ev.variantId ? { ...prev, heatmap: hm } : prev));
            setChampion((prev) => (prev && prev.id === ev.variantId ? { ...prev, heatmap: hm } : prev));
          } else if (ev.type === "focus_group") {
            setLiveFocusQuotes((prev) => ({ ...prev, [ev.generation]: ev.quotes }));
          } else if (ev.type === "creative_room") {
            setFunnelCandidates(ev.candidates);
          } else if (ev.type === "diagnosis") {
            setDiagnoses((prev) => [
              ...prev,
              {
                generation: ev.generation,
                stage: ev.stage,
                diagnosis: ev.diagnosis,
                objections: ev.objections,
                landingPageTips: ev.landingPageTips,
                focusGroupQuotes: ev.focusGroupQuotes,
                heatmap: [],
              },
            ]);
          } else if (ev.type === "variant_done") {
            if (ev.variant.generation === 0) setOriginal(ev.variant);
            setChampion(ev.champion);
            setLiveAdForInterview(ev.variant.ad);
            setVariants((prev) => [...prev, ev.variant]);
            setChampionHistory(ev.championHistory);
          } else if (ev.type === "head_to_head") {
            setHeadToHead((prev) => [...prev, ev.result]);
            setChampion(ev.champion);
            setChampionHistory(ev.championHistory);
          } else if (ev.type === "holdout_done") {
            setHoldout(ev.holdout);
          } else if (ev.type === "feed_battle") {
            setFeedBattle(ev.result);
          } else if (ev.type === "comments_ready") {
            setSimulatedComments(ev.comments);
          } else if (ev.type === "social_contagion") {
            setSocialContagion(ev.result);
          } else if (ev.type === "counterfactual_xray") {
            setCounterfactualXray(ev.result);
          } else if (ev.type === "complete") {
            setCompletedRun(ev.run);
            setOriginal(ev.run.original);
            setChampion(ev.run.champion);
            setVariants(ev.run.variants);
            setDiagnoses(ev.run.diagnoses);
            setFunnelCandidates(ev.run.funnelCandidates);
            setHeadToHead(ev.run.headToHead ?? []);
            setSplitAdvice(ev.run.splitAdvice);
            setChampionHistory(ev.run.championHistory);
            setHoldout(ev.run.holdout);
            setFeedBattle(ev.run.feedBattle);
            setSimulatedComments(ev.run.simulatedComments);
            setSocialContagion(ev.run.socialContagion);
            setCounterfactualXray(ev.run.counterfactualXray);
            setLaunchKit(ev.run.launchKit);
            setCurrentPhase("done");
            setInspectedVariantId(ev.run.champion.id);
            onRunSaved();
          } else if (ev.type === "error") {
            setError(ev.message);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در اجرای آزمایش");
    } finally {
      setIsRunning(false);
    }
  };

  const inDashboardMode = isRunning || Boolean(displayOriginal);

  // ---------- COMPOSER MODE ----------
  if (!inDashboardMode) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Clean Editorial Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              آزمایشگاه تکامل تبلیغ
            </h1>
            <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed">
              تبلیغ را پیش از انتشار روی جمعیت شبیه‌سازی‌شده ایران بسنجید و طی چند نسل بهینه کنید.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-zinc-400 tabular-nums shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>
              <strong className="text-zinc-200 font-semibold">{allPersonas.length.toLocaleString("fa-IR")}</strong>{" "}
              پروفایل در بانک
            </span>
          </div>
        </div>

        {/* Presets Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESETS.map((pr) => {
            const selected = ad.headline === pr.ad.headline;
            return (
              <button
                key={pr.id}
                type="button"
                onClick={() => {
                  setAd(pr.ad);
                  setProductTruth(pr.productTruth);
                }}
                className={`text-right rounded-xl border px-3.5 py-3 transition-colors cursor-pointer ${
                  selected
                    ? "bg-white/[0.05] border-white/25 text-white"
                    : "bg-[#111113] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.15]"
                }`}
              >
                <div className="text-[11px] text-zinc-500 mb-1">{pr.category}</div>
                <div className={`text-xs font-semibold leading-snug ${selected ? "text-white" : "text-zinc-200"}`}>
                  {pr.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Architectural Composer Panel */}
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-white/[0.06]">
            {/* Right column (RTL start): Ad Copy g0 */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-zinc-200">متن تبلیغ پایه (g0)</span>
                <div className="inline-flex flex-wrap p-0.5 rounded-lg bg-[#09090B] border border-white/[0.06] text-[11px]">
                  {(
                    [
                      ["instagram_story", "استوری اینستا"],
                      ["instagram_reels", "ریلز"],
                      ["telegram", "تلگرام"],
                      ["banner", "یکتانت"],
                      ["divar", "دیوار"],
                    ] as const
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAd((p) => ({ ...p, platform: k }))}
                      className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                        ad.platform === k || (k === "instagram_story" && ad.platform === "instagram")
                          ? "bg-white/[0.1] text-white font-medium"
                          : "text-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 mb-1.5">
                  {ad.platform === "instagram_story" || ad.platform === "instagram"
                    ? "فریم ۱ استوری (قلاب روی تصویر — ۵ ثانیه اول)"
                    : ad.platform === "instagram_reels"
                      ? "قلاب ۰ تا ۳ ثانیه ریلز (تیتر روی ویدیو + گفتار اول)"
                      : ad.platform === "banner"
                        ? "تیتر همسان یکتانت (حداکثر ۴۸ کاراکتر)"
                        : ad.platform === "divar"
                          ? "عنوان آگهی دیوار"
                          : "تیتر پست تلگرام"}
                </label>
                <input
                  type="text"
                  value={ad.headline}
                  onChange={(e) => setAd((p) => ({ ...p, headline: e.target.value }))}
                  placeholder={
                    ad.platform === "instagram_reels"
                      ? "جمله‌ای که در ۳ ثانیه اول جلوی سوایپ را می‌گیرد..."
                      : ad.platform === "instagram_story"
                        ? "متن کوتاه روی فریم ۱ (۳ تا ۸ کلمه)..."
                        : "تیتر اولی که مخاطب می‌بیند..."
                  }
                  className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 mb-1.5">
                  {ad.platform === "instagram_story" || ad.platform === "instagram"
                    ? "فریم ۲ استوری (توضیح کوتاه و اثبات)"
                    : ad.platform === "instagram_reels"
                      ? "سناریوی ۱۵ ثانیه‌ای ویدیو (تصویر + پیام)"
                      : "متن اصلی"}
                </label>
                <textarea
                  rows={4}
                  value={ad.body}
                  onChange={(e) => setAd((p) => ({ ...p, body: e.target.value }))}
                  placeholder={
                    ad.platform === "instagram_reels"
                      ? "توضیح کوتاه آنچه در ویدیو نمایش داده و گفته می‌شود..."
                      : "متن کوتاه و اصلی تبلیغ..."
                  }
                  className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13.5px] text-zinc-100 leading-[1.8] placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 mb-1.5">
                  {ad.platform === "instagram_story" || ad.platform === "instagram"
                    ? "فریم ۳ استوری (متن استیکر لینک)"
                    : ad.platform === "instagram_reels"
                      ? "فراخوان پایان ریلز (محرک کامنت دایرکت یا لینک)"
                      : "دکمه اقدام (CTA)"}
                </label>
                <input
                  type="text"
                  value={ad.cta}
                  onChange={(e) => setAd((p) => ({ ...p, cta: e.target.value }))}
                  placeholder={
                    ad.platform === "instagram_reels"
                      ? "مثلاً: کلمه «اکسل» رو کامنت کن لینک بیاد دایرکتت"
                      : "مثلاً: ۷ روز تست رایگان"
                  }
                  className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>

              {/* Optional Multimodal Image Upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {ad.imageDataUrl ? (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[#09090B] border border-white/[0.08]">
                    <img
                      src={ad.imageDataUrl}
                      alt="تصویر بنر"
                      className="w-16 h-11 object-cover rounded border border-white/[0.08]"
                    />
                    <div className="flex-1 text-xs text-zinc-300">
                      تصویر بنر ضمیمه شد و همراه متن ارزیابی می‌شود.
                    </div>
                    <button
                      type="button"
                      onClick={() => setAd((p) => ({ ...p, imageDataUrl: undefined }))}
                      aria-label="حذف تصویر"
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-white/[0.12] bg-[#09090B]/60 text-xs text-zinc-400 hover:text-zinc-200 hover:border-white/25 transition-colors cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>افزودن تصویر بنر (اختیاری — ارزیابی همزمان تصویر و متن)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Left column (RTL end): Product Truth + Experiment Parameters */}
            <div className="p-5 sm:p-6 flex flex-col justify-between gap-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  واقعیات و محدودیت‌های محصول
                </label>
                <p className="text-[11.5px] text-zinc-500 mb-2.5 leading-relaxed">
                  قیمت واقعی، مجوزها، شرایط ارسال و ضمانت را بنویسید تا مدل در نسل‌های بعدی ادعای غیرواقعی تولید نکند.
                </p>
                <textarea
                  rows={6}
                  value={productTruth}
                  onChange={(e) => setProductTruth(e.target.value)}
                  placeholder="مثلاً: قیمت واقعی، امکان پرداخت قسطی، اینماد، ضمانت بازگشت وجه..."
                  className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[12.5px] text-zinc-200 leading-[1.85] placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>

              {/* Voice Register Lock + DeepSeek Reasoning Depth */}
              <div className="pt-4 border-t border-white/[0.06] space-y-3">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <label className="text-[11px] font-medium text-zinc-300">قفل لحن فارسی (Voice Register)</label>
                    <span className="text-[11px] text-zinc-500">
                      {VOICE_REGISTERS.find((v) => v.key === voiceRegister)?.hint}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {VOICE_REGISTERS.map((vr) => (
                      <button
                        key={vr.key}
                        type="button"
                        onClick={() => setVoiceRegister(vr.key)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11.5px] transition-colors cursor-pointer ${
                          voiceRegister === vr.key
                            ? "bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold"
                            : "bg-[#09090B] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.16]"
                        }`}
                      >
                        {vr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reasoning Depth (100% deepseek-flash: max vs high) + Feed Battle toggle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] text-zinc-500 mb-1">عمق استدلال اتاق خلاقیت (Flash)</label>
                    <div className="grid grid-cols-2 gap-1 bg-[#09090B] p-0.5 rounded-lg border border-white/[0.08] text-[11px]">
                      <button
                        type="button"
                        onClick={() => setReasoningMode("max")}
                        className={`py-1.5 rounded-md transition-colors cursor-pointer ${
                          reasoningMode === "max"
                            ? "bg-white/[0.12] text-white font-semibold"
                            : "text-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        حداکثر کیفیت (max)
                      </button>
                      <button
                        type="button"
                        onClick={() => setReasoningMode("high")}
                        className={`py-1.5 rounded-md transition-colors cursor-pointer ${
                          reasoningMode === "high"
                            ? "bg-white/[0.12] text-white font-semibold"
                            : "text-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        سریع و قوی (high)
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-zinc-500">رقبای بازار (آزمون فید)</label>
                      <button
                        type="button"
                        onClick={() => setEnableFeedBattle((v) => !v)}
                        className={`text-[10.5px] cursor-pointer ${
                          enableFeedBattle ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {enableFeedBattle ? "فعال" : "غیرفعال"}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={competitorContext}
                      onChange={(e) => setCompetitorContext(e.target.value)}
                      disabled={!enableFeedBattle}
                      placeholder="اختیاری (مثلاً طلاسی، ملّی‌گلد...)"
                      className="w-full bg-[#09090B] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11.5px] text-zinc-200 placeholder:text-zinc-600 disabled:opacity-40 focus:outline-none focus:border-white/30"
                    />
                  </div>
                </div>
              </div>

              {/* Experiment Knobs — directly on surface, clean hairline top divider */}
              <div className="pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-[11px] text-zinc-500 mb-1.5">جمعیت آموزش</label>
                  <select
                    value={crowdSize}
                    onChange={(e) => setCrowdSize(Number(e.target.value))}
                    className="w-full min-w-0 bg-[#09090B] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 tabular-nums focus:outline-none focus:border-white/30"
                  >
                    <option value={36}>۳۶ نفر — سریع</option>
                    <option value={60}>۶۰ نفر — متعادل</option>
                    <option value={120}>۱۲۰ نفر — دقیق</option>
                    <option value={200}>۲۰۰ نفر — گسترده</option>
                    <option value={300}>۳۰۰ نفر — ملی</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label className="block text-[11px] text-zinc-500 mb-1.5">جمعیت پنهان (Holdout)</label>
                  <select
                    value={holdoutSize}
                    onChange={(e) => setHoldoutSize(Number(e.target.value))}
                    className="w-full min-w-0 bg-[#09090B] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 tabular-nums focus:outline-none focus:border-white/30"
                  >
                    <option value={12}>۱۲ نفر دیده‌نشده</option>
                    <option value={24}>۲۴ نفر دیده‌نشده</option>
                    <option value={36}>۳۶ نفر دیده‌نشده</option>
                    <option value={48}>۴۸ نفر دیده‌نشده</option>
                    <option value={60}>۶۰ نفر دیده‌نشده</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label className="block text-[11px] text-zinc-500 mb-1.5">تعداد نسل</label>
                  <select
                    value={generations}
                    onChange={(e) => setGenerations(Number(e.target.value))}
                    className="w-full min-w-0 bg-[#09090B] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 tabular-nums focus:outline-none focus:border-white/30"
                  >
                    <option value={0}>فقط ارزیابی (۰ نسل)</option>
                    <option value={1}>۱ نسل بهینه‌سازی</option>
                    <option value={2}>۲ نسل بهینه‌سازی</option>
                    <option value={3}>۳ نسل بهینه‌سازی</option>
                    <option value={4}>۴ نسل بهینه‌سازی</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label className="block text-[11px] text-zinc-500 mb-1.5">نسخه در هر نسل</label>
                  <select
                    value={variantsPerGen}
                    onChange={(e) => setVariantsPerGen(Number(e.target.value))}
                    className="w-full min-w-0 bg-[#09090B] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 tabular-nums focus:outline-none focus:border-white/30"
                  >
                    <option value={2}>۲ نسخه رقیب</option>
                    <option value={3}>۳ نسخه رقیب</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Audience Filter Drawer */}
          {showFilters && (
            <div className="border-t border-white/[0.06] bg-[#0B0B0D] px-5 sm:px-6 py-4 space-y-4 text-xs">
              {icpNote && (
                <div className="border-r-2 border-r-emerald-400 bg-white/[0.025] px-3.5 py-2.5 rounded-l-lg flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="text-zinc-200 leading-relaxed">
                    <span className="text-emerald-400 font-semibold ml-1.5">مخاطب پیشنهادی ({icpNote.label}):</span>
                    {icpNote.rationale}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <div className="text-[11px] text-zinc-500 mb-2">سطح شهر</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CITY_TIERS.map((ct) => {
                      const on = filters.cityTiers?.includes(ct);
                      return (
                        <button
                          key={ct}
                          type="button"
                          onClick={() => toggleFilterItem("cityTiers", ct)}
                          className={`px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                            on
                              ? "bg-zinc-100 border-zinc-100 text-zinc-950 font-medium"
                              : "bg-transparent border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.16]"
                          }`}
                        >
                          {ct}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-zinc-500 mb-2">سطح درآمد</div>
                  <div className="flex flex-wrap gap-1.5">
                    {INCOME_TIERS.map((inc) => {
                      const on = filters.incomeTiers?.includes(inc);
                      return (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => toggleFilterItem("incomeTiers", inc)}
                          className={`px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                            on
                              ? "bg-zinc-100 border-zinc-100 text-zinc-950 font-medium"
                              : "bg-transparent border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.16]"
                          }`}
                        >
                          {inc}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-zinc-500">جنسیت:</span>
                    {(["all", "زن", "مرد"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setFilters((p) => ({ ...p, gender: g }))}
                        className={`px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                          filters.gender === g
                            ? "bg-zinc-100 border-zinc-100 text-zinc-950 font-medium"
                            : "bg-transparent border-white/[0.08] text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {g === "all" ? "همه" : g}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500">سن:</span>
                    <input
                      type="number"
                      min={18}
                      max={70}
                      placeholder="۱۸"
                      value={filters.minAge ?? ""}
                      onChange={(e) =>
                        setFilters((p) => ({ ...p, minAge: e.target.value ? Number(e.target.value) : undefined }))
                      }
                      className="w-16 bg-[#09090B] border border-white/[0.08] rounded-md px-2 py-1 text-white tabular-nums focus:outline-none focus:border-white/30"
                    />
                    <span className="text-zinc-600">تا</span>
                    <input
                      type="number"
                      min={18}
                      max={70}
                      placeholder="۶۸"
                      value={filters.maxAge ?? ""}
                      onChange={(e) =>
                        setFilters((p) => ({ ...p, maxAge: e.target.value ? Number(e.target.value) : undefined }))
                      }
                      className="w-16 bg-[#09090B] border border-white/[0.08] rounded-md px-2 py-1 text-white tabular-nums focus:outline-none focus:border-white/30"
                    />
                  </div>

                  {customTags.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-500">گروه سفارشی:</span>
                      <select
                        value={filters.customTag ?? "all"}
                        onChange={(e) =>
                          setFilters((p) => ({ ...p, customTag: e.target.value === "all" ? undefined : e.target.value }))
                        }
                        className="bg-[#09090B] border border-white/[0.08] rounded-md px-2.5 py-1 text-zinc-100 focus:outline-none focus:border-white/30"
                      >
                        <option value="all">همه جمعیت</option>
                        {customTags.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {availableSectors.length > 0 && (
                <div className="pt-3 border-t border-white/[0.05]">
                  <div className="text-[11px] text-zinc-500 mb-2">حوزه شغلی (اختیاری)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSectors.map((sec) => {
                      const on = filters.sectors?.includes(sec);
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => toggleFilterItem("sectors", sec)}
                          className={`px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer ${
                            on
                              ? "bg-zinc-100 border-zinc-100 text-zinc-950 font-medium"
                              : "bg-transparent border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.16]"
                          }`}
                        >
                          {sec}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Footer Bar */}
          <div className="border-t border-white/[0.06] px-5 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap bg-[#0E0E10]">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleAutoICP}
                disabled={icpLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.12] bg-[#141417] hover:bg-[#1A1A1E] disabled:opacity-50 text-xs font-medium text-zinc-100 transition-colors cursor-pointer"
              >
                {icpLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>انتخاب هوشمند مخاطب (Auto-ICP)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                <span>فیلتر دستی</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${showFilters ? "rotate-180" : ""}`}
                />
              </button>

              <span className="text-zinc-700">·</span>

              <span className="text-xs text-zinc-400 tabular-nums">
                <strong className="text-zinc-100 font-semibold">{matchedCount.toLocaleString("fa-IR")}</strong> نفر
                مطابق فیلتر
              </span>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setFilters({ gender: "all" });
                    setIcpNote(null);
                  }}
                  className="text-[11px] text-zinc-500 hover:text-zinc-200 underline underline-offset-4 cursor-pointer"
                >
                  حذف فیلترها
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={startEvolution}
              disabled={matchedCount < 10}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-35 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>شروع ارزیابی و بهینه‌سازی</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/[0.08] border border-red-500/25 rounded-lg p-3.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  // ---------- LIVE / COMPLETED EVOLUTION DASHBOARD ----------
  const stepPills = [
    { key: "orig", label: "اصلی", gen: 0 },
    ...Array.from({ length: displayGens }, (_, i) => ({ key: `g${i + 1}`, label: `g${i + 1}`, gen: i + 1 })),
    ...(displayGens > 0 ? [{ key: "holdout", label: "تست پنهان", gen: displayGens + 1 }] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Top Stepper + Meta + New Run */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {stepPills.map((sp) => {
            const isHoldoutPill = sp.key === "holdout";
            const done =
              currentPhase === "done" ||
              Boolean(loadedRun) ||
              (isHoldoutPill
                ? Boolean(displayHoldout)
                : activeGen > sp.gen || (sp.gen === 0 && Boolean(displayOriginal)));
            const active =
              isRunning &&
              ((isHoldoutPill && (currentPhase === "holdout_orig" || currentPhase === "holdout_champ")) ||
                (!isHoldoutPill && activeGen === sp.gen));
            return (
              <span
                key={sp.key}
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-sky-500/12 border-sky-400/60 text-sky-300"
                    : done
                      ? "bg-emerald-500/[0.08] border-emerald-500/35 text-emerald-400"
                      : "bg-transparent border-white/[0.08] text-zinc-500"
                }`}
              >
                {sp.label}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          {displayRun && (
            <div className="hidden md:flex items-center gap-2.5 text-xs text-zinc-500 tabular-nums">
              <span>
                {displayRun.trainCount} آموزش + {displayRun.holdoutCount} پنهان
              </span>
              <span className="text-zinc-700">·</span>
              <span>{(displayRun.totalDurationMs / 1000).toFixed(1)} ثانیه</span>
              <span className="text-zinc-700">·</span>
              <span className="font-mono text-zinc-300" dir="ltr">
                ${displayRun.totalCostUsd.toFixed(4)}
              </span>
            </div>
          )}

          <button
            type="button"
            disabled={isRunning}
            onClick={resetToComposer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] bg-[#111113] hover:bg-[#18181B] disabled:opacity-40 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>آزمایش جدید</span>
          </button>
        </div>
      </div>

      {/* Sleek Live Status Strip */}
      {isRunning && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-zinc-100 truncate">{statusMessage}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                {currentPhase === "creative_room"
                  ? "۴ کارگردان تخصصی ایران (بینش فرهنگی، بیلبورد، ضدکلیشه، پرفورمنس) همزمان روی deepseek-flash در حال ایده‌پردازی‌اند"
                  : currentPhase === "copy_chief"
                    ? "سردبیر کپی در حال جراحی زبانی فارسی بومی، حذف ترجمه‌زدگی و ممیزی ضدتوهم مطابق واقعیات محصول است"
                    : currentPhase === "funnel_screen"
                      ? "غربالگری سریع تیترها روی ۳۰ مخاطب هدف برای ورود بهترین ایده‌ها به قضاوت کامل"
                      : currentPhase === "focus_group"
                        ? "مصاحبه واقعی System-2 با ۴ مخاطب قابل‌جذب برای استخراج دلیل دقیق ریزش"
                        : currentPhase === "mutating"
                          ? "deepseek-flash با ترکیب ژنتیکی آرشیو نخبگان (MAP-Elites) و صدای مخاطبان، فینالیست‌های جدید می‌سازد"
                          : currentPhase === "duel"
                            ? "مقایسه مستقیم رو‌در‌رو (A در برابر B) با توازن ترتیب گزینه‌ها برای حذف خطای اشباع امتیاز"
                            : currentPhase === "feed_battle"
                              ? "آزمون شلوغی فید واقعی در برابر ۳ تبلیغ رقیب ایرانی در چهار جایگاه متوازن"
                              : `Perplexity Decider v1.3 · تست ۲ مرحله‌ای (توقف تیتر + متن کامل) روی ${trainTotal} آموزش و ${holdoutTotal} پنهان`}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/[0.08] border border-red-500/25 rounded-lg p-3.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Original -> Champion Comparison */}
      {displayOriginal && displayChampion && (
        <AdComparisonCards original={displayOriginal} champion={displayChampion} />
      )}

      {/* Architectural Unseen Holdout Verification Strip */}
      {displayHoldout && (
        <section className="rounded-xl border border-white/[0.08] border-r-2 border-r-sky-400 bg-[#111113] p-5">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white">تایید مستقل روی جمعیت پنهان (Holdout)</h3>
                <span className="text-xs text-sky-400 tabular-nums">
                  · {displayHoldout.champion.judgments.length} مخاطب دیده‌نشده
                </span>
                {typeof displayHoldout.statisticallySignificant === "boolean" && (
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded border tabular-nums ${
                      displayHoldout.statisticallySignificant
                        ? "border-emerald-500/35 bg-emerald-500/[0.08] text-emerald-300"
                        : "border-white/[0.1] bg-white/[0.04] text-zinc-400"
                    }`}
                  >
                    {displayHoldout.statisticallySignificant ? "معنادار آماری" : "تفاوت مرزی"}
                    {typeof displayHoldout.pValue === "number" ? ` (p=${displayHoldout.pValue < 0.001 ? "<0.001" : displayHoldout.pValue.toFixed(3)})` : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                این افراد در چرخه تکامل حضور نداشتند؛ تفاوت زیر بیانگر اثر واقعی تغییر متن بدون بیش‌برازش است.
                {typeof displayHoldout.ci95Low === "number" && typeof displayHoldout.ci95High === "number" && (
                  <span className="text-zinc-300 mr-1.5 tabular-nums" dir="ltr">
                    [95% CI: {displayHoldout.ci95Low >= 0 ? `+${displayHoldout.ci95Low}` : displayHoldout.ci95Low} to{" "}
                    {displayHoldout.ci95High >= 0 ? `+${displayHoldout.ci95High}` : displayHoldout.ci95High}]
                  </span>
                )}
                {typeof displayHoldout.winRatePct === "number" && (
                  <span className="text-zinc-400 mr-1.5 tabular-nums">
                    · برتری فردی روی <strong className="text-zinc-200">{displayHoldout.winRatePct}٪</strong> مخاطبان پنهان
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-6 tabular-nums flex-wrap">
              <div>
                <div className="text-[11px] text-zinc-500">نسخه اصلی</div>
                <div className="text-lg font-semibold text-zinc-300 mt-0.5">
                  {displayHoldout.original.fitness.toFixed(1)}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-zinc-500">قهرمان نهایی</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-lg font-bold text-white">{displayHoldout.champion.fitness.toFixed(1)}</span>
                  <span
                    className={`text-xs font-semibold ${
                      displayHoldout.fitnessLift >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                    dir="ltr"
                  >
                    {displayHoldout.fitnessLift >= 0
                      ? `+${displayHoldout.fitnessLift.toFixed(1)}`
                      : displayHoldout.fitnessLift.toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="hidden sm:flex flex-col text-xs text-zinc-400 gap-0.5 border-r border-white/[0.08] pr-5">
                <span>
                  رشد کلیک:{" "}
                  <strong
                    className={`font-semibold ${displayHoldout.clickLift >= 0 ? "text-sky-400" : "text-red-400"}`}
                    dir="ltr"
                  >
                    {displayHoldout.clickLift >= 0 ? `+${displayHoldout.clickLift}%` : `${displayHoldout.clickLift}%`}
                  </strong>
                </span>
                <span>
                  رشد اعتماد:{" "}
                  <strong
                    className={`font-semibold ${displayHoldout.trustLift >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    dir="ltr"
                  >
                    {displayHoldout.trustLift >= 0 ? `+${displayHoldout.trustLift}%` : `${displayHoldout.trustLift}%`}
                  </strong>
                </span>
                {displayHoldout.headToHead && (
                  <span>
                    دوئل مستقیم پنهان:{" "}
                    <strong className="font-semibold text-white" dir="ltr">
                      {displayHoldout.headToHead.championWinPct}% vs {displayHoldout.headToHead.originalWinPct}%
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center gap-2 flex-wrap text-xs">
            <button
              type="button"
              onClick={() => setInspectedVariantId("holdout_orig")}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                inspectedVariantId === "holdout_orig"
                  ? "bg-white/[0.1] text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              ماتریس جمعیت پنهان · نسخه اصلی
            </button>
            <button
              type="button"
              onClick={() => setInspectedVariantId("holdout_champ")}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                inspectedVariantId === "holdout_champ"
                  ? "bg-white/[0.1] text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              ماتریس جمعیت پنهان · قهرمان نهایی
            </button>
          </div>
        </section>
      )}

      {/* Evolution Fitness Curve */}
      {displayHistory.length > 0 && <EvolutionChart history={displayHistory} holdout={displayHoldout} />}

      {/* THE HERO DOT MATRIX */}
      {(isRunning || inspectedVariant) && (
        <CrowdJudgingMatrix
          title={
            isRunning
              ? "جمعیت در حال قضاوت است"
              : inspectedVariantId === "holdout_orig"
                ? "قضاوت جمعیت پنهان · نسخه اصلی"
                : inspectedVariantId === "holdout_champ"
                  ? "قضاوت جمعیت پنهان · قهرمان نهایی"
                  : `قضاوت جمعیت: ${inspectedVariant?.strategy ?? "قهرمان نهایی"}`
          }
          subtitle={
            isRunning
              ? activeVariantLabel
              : inspectedVariantId === "holdout_orig" || inspectedVariantId === "holdout_champ"
                ? "جمعیت دیده‌نشده (Holdout)"
                : inspectedVariant
                  ? `نسل ${inspectedVariant.generation}`
                  : undefined
          }
          isLive={
            isRunning &&
            (currentPhase === "orig" ||
              currentPhase === "judging" ||
              currentPhase === "holdout_orig" ||
              currentPhase === "holdout_champ")
          }
          totalExpected={matrixExpected}
          judgments={matrixJudgments}
          runningMetrics={matrixMetrics}
          onSelectPerson={(j) => onOpenInterview(j.personaId, j, matrixAd)}
        />
      )}

      {/* Segment Breakdown */}
      {!isRunning && inspectedVariant && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SegmentCard title="عملکرد بر اساس شهر" items={inspectedVariant.segmentsByCityTier} />
            <SegmentCard title="عملکرد بر اساس سطح درآمد" items={inspectedVariant.segmentsByIncome} />
          </div>
          {inspectedVariant.segmentsByArchetype && inspectedVariant.segmentsByArchetype.length > 0 && (
            <SegmentCard title="عملکرد بر اساس تیپ تصمیم‌گیری خریدار ایرانی" items={inspectedVariant.segmentsByArchetype} />
          )}
        </div>
      )}

      {/* Multi-Segment Split Campaign Advisor (#3) */}
      {!isRunning && displaySplitAdvice && displaySplitAdvice.winners.length > 0 && (
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-white/[0.06] flex items-baseline justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  displaySplitAdvice.shouldSplit ? "bg-amber-400" : "bg-emerald-500"
                }`}
              />
              <h3 className="text-[13px] font-semibold text-zinc-100">
                {displaySplitAdvice.shouldSplit
                  ? "پیشنهاد تفکیک کمپین (Split Campaign Advisor)"
                  : "برنده یکپارچه در تمام بخش‌های بازار"}
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500">
              بهترین نسخه برای هر بخش از مخاطبان (کلیک برای بررسی)
            </span>
          </div>

          <div className="px-5 sm:px-6 py-3.5 border-b border-white/[0.05] text-xs text-zinc-300 leading-[1.8] bg-white/[0.015]">
            {displaySplitAdvice.summary}
          </div>

          <div className="divide-y divide-white/[0.05]">
            {displaySplitAdvice.winners.map((w) => {
              const isDifferent = w.winnerId !== displayChampion?.id && w.marginOverChampion >= 2.5;
              return (
                <button
                  key={`${w.group}-${w.segment}`}
                  type="button"
                  onClick={() => setInspectedVariantId(w.winnerId)}
                  className={`w-full text-right px-5 sm:px-6 py-3 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                    isDifferent ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.07]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] text-zinc-500 min-w-[44px]">{w.groupLabel}</span>
                    <span className="text-xs font-semibold text-zinc-100 shrink-0">
                      {w.segment}{" "}
                      <span className="text-zinc-500 font-normal tabular-nums">({w.count})</span>
                    </span>
                    <span className="text-zinc-700 hidden sm:inline">←</span>
                    <span className="text-[11px] font-mono text-zinc-400 shrink-0" dir="ltr">
                      {w.winnerId}
                    </span>
                    <span className="text-xs text-zinc-300 truncate hidden md:inline">
                      «{w.winnerHeadline}»
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums text-xs">
                    {isDifferent ? (
                      <span className="text-amber-300 font-semibold" dir="ltr">
                        +{w.marginOverChampion.toFixed(1)} برتری
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-[11px]">قهرمان کل</span>
                    )}
                    <span className="font-bold text-white min-w-[34px] text-left" dir="ltr">
                      {w.winnerFitness.toFixed(1)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* V3 Creative Room Funnel, Simulated Feed Battle, Comments Simulator & Launch Kit */}
      {displayChampion && (
        <PostLaunchPanel
          runId={displayRun?.id}
          championAd={displayChampion.ad}
          productTruth={displayRun?.productTruth ?? productTruth}
          voiceRegister={displayRun?.voiceRegister ?? voiceRegister}
          funnelCandidates={displayFunnel}
          feedBattle={displayFeedBattle}
          socialContagion={displaySocialContagion}
          counterfactualXray={displayCounterfactualXray}
          comments={displayComments}
          launchKit={displayLaunchKit}
          isRunning={isRunning}
          onCommentsGenerated={(nextComments) => {
            if (loadedRun) {
              setLoadedCommentsOverride((prev) => ({ ...prev, [loadedRun.id]: nextComments }));
            } else {
              setSimulatedComments(nextComments);
            }
          }}
          onLaunchKitGenerated={(kit) => {
            if (loadedRun) {
              setLoadedKitOverride((prev) => ({ ...prev, [loadedRun.id]: kit }));
            } else {
              setLaunchKit(kit);
            }
          }}
          onOpenPersona={(pid) => onOpenInterview(pid, undefined, displayChampion.ad)}
        />
      )}

      {/* Clean Unified Variants & Generation Diagnostics List */}
      {displayVariants.length > 0 && (
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-semibold text-zinc-200">نسخه‌های ارزیابی‌شده</h3>
            <span className="text-[11px] text-zinc-500">
              برای مشاهده ماتریس نقاط، روی هر نسخه کلیک کنید
            </span>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {Array.from(new Set(displayVariants.map((v) => v.generation)))
              .sort((a, b) => a - b)
              .map((gen) => {
                const genVars = displayVariants.filter((v) => v.generation === gen);
                const diag = displayDiagnoses.find((d) => d.generation === gen);
                const quotes = diag?.focusGroupQuotes ?? liveFocusQuotes[gen] ?? [];
                const duel = displayHeadToHead.find((d) => d.generation === gen);
                const stageName =
                  diag?.stage === "diverge"
                    ? "واگرایی مفهومی"
                    : diag?.stage === "crossover"
                      ? "ترکیب ژنتیکی و جراحی اعتراض‌ها"
                      : diag?.stage === "polish"
                        ? "صیقل نهایی لحن و دوئل"
                        : null;
                return (
                  <div key={gen}>
                    {/* Generation subheader */}
                    <div className="px-5 sm:px-6 py-2.5 bg-[#0D0D0F] text-[11px] font-medium text-zinc-500 flex items-center justify-between gap-2">
                      <span>
                        {gen === 0 ? "نسل ۰ — نسخه اصلی" : `نسل ${gen}${stageName ? ` · ${stageName}` : ""}`}
                      </span>
                      {duel && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-sky-400 tabular-nums">
                          <Swords className="w-3 h-3" />
                          <span>
                            دوئل {duel.championId} در برابر {duel.challengerId}:
                          </span>
                          <strong dir="ltr">
                            {duel.championWinPct}% – {duel.challengerWinPct}%
                          </strong>
                          {duel.promotedByDuel && (
                            <span className="text-emerald-400 font-semibold">(برنده جدید با رای مستقیم!)</span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Generation Diagnosis + Live Focus Group Verbatim Quotes */}
                    {(diag || quotes.length > 0) && (
                      <div className="px-5 sm:px-6 py-3.5 border-t border-white/[0.05] bg-white/[0.015] space-y-2.5">
                        {diag && (
                          <div className="text-xs text-zinc-300 leading-[1.8]">
                            <span className="text-zinc-500 font-medium ml-1.5">تحلیل نسل:</span>
                            {diag.diagnosis}
                          </div>
                        )}
                        {quotes.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                            {quotes.map((q) => (
                              <button
                                key={q.personaId}
                                type="button"
                                onClick={() => onOpenInterview(q.personaId, undefined, displayChampion?.ad ?? ad)}
                                className="text-right rounded-lg border border-white/[0.06] bg-[#0B0B0D] hover:border-white/[0.15] px-3 py-2 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center justify-between gap-2 text-[10.5px] text-zinc-500 mb-1">
                                  <span className="text-zinc-300 font-medium">
                                    {q.name} · {q.age}س · {q.city} ({q.job})
                                  </span>
                                  <span className="tabular-nums">اعتماد {q.trustPct}٪</span>
                                </div>
                                <div className="text-[11.5px] text-zinc-400 leading-[1.65]">«{q.quote}»</div>
                              </button>
                            ))}
                          </div>
                        )}
                        {diag?.landingPageTips && diag.landingPageTips.length > 0 && (
                          <div className="pt-1.5 border-t border-white/[0.05] text-[11.5px] text-zinc-400 space-y-1">
                            <span className="text-sky-400 font-medium">توصیه برای لندینگ‌پیج (خارج از متن تبلیغ):</span>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {diag.landingPageTips.map((tip, i) => (
                                <span key={i} className="inline-flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-sky-400 shrink-0" />
                                  <span>{tip}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {diag && diag.objections.length > 0 && quotes.length === 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-zinc-400">
                            {diag.objections.map((ob, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                                <span>«{ob}»</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Variant Rows */}
                    <div className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
                      {genVars.map((v) => {
                        const isChamp = displayChampion?.id === v.id;
                        const isSelected = inspectedVariant?.id === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setInspectedVariantId(v.id)}
                            className={`w-full text-right px-5 sm:px-6 py-3.5 transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-white/[0.05]"
                                : isChamp
                                  ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]"
                                  : "hover:bg-white/[0.025]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isChamp ? "bg-emerald-400" : isSelected ? "bg-sky-400" : "bg-zinc-700"
                                  }`}
                                />
                                <span className="text-[11px] font-mono text-zinc-500 shrink-0" dir="ltr">
                                  {v.id}
                                </span>
                                <span className="text-[13.5px] font-semibold text-zinc-100 truncate">
                                  {v.ad.headline}
                                </span>
                                <span className="hidden sm:inline text-[11px] text-zinc-500 shrink-0">
                                  · {v.director ? `${v.director} — ` : ""}
                                  {v.strategy}
                                </span>
                              </div>

                              <div className="flex items-center gap-4 shrink-0 tabular-nums">
                                <span className="hidden md:inline text-[11px] text-zinc-500">
                                  تیتر {Math.round(v.stop)}٪ · کلیک {Math.round(v.click)}٪ · اعتماد {Math.round(v.trust)}٪ · کپی {Math.round(v.brandCraft ?? v.naturalness ?? v.clarity)}٪
                                </span>
                                <span
                                  className={`text-sm font-bold min-w-[36px] text-left ${
                                    isChamp ? "text-emerald-400" : "text-zinc-200"
                                  }`}
                                  dir="ltr"
                                >
                                  {v.fitness.toFixed(1)}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2 pr-[18px] leading-[1.7]">
                              {v.ad.body}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}

function SegmentCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number; fitness: number; click: number; trust: number }>;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
      <h4 className="text-xs font-semibold text-zinc-300">{title}</h4>
      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-zinc-200 font-medium">
                {it.label}{" "}
                <span className="text-zinc-500 text-[11px] tabular-nums">({it.count})</span>
              </span>
              <span className="tabular-nums text-[11px] text-zinc-500">
                کلیک <span className="text-zinc-300">{Math.round(it.click)}٪</span> · اعتماد{" "}
                <span className={it.trust < 35 ? "text-red-400" : "text-zinc-300"}>{Math.round(it.trust)}٪</span> ·{" "}
                <strong className="text-white font-semibold">{it.fitness.toFixed(1)}</strong>
              </span>
            </div>
            <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full ${it.fitness >= 60 ? "bg-emerald-500" : "bg-zinc-400"}`}
                style={{ width: `${Math.min(100, Math.max(3, it.fitness))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
