export type ReactionType = "annoyed" | "neutral" | "curious" | "excited";

export type VoiceRegister = "colloquial" | "friendly" | "modern_pro" | "bold_genz";

export type ReasoningMode = "high" | "max";

export interface CopyChiefReview {
  persianCraft: number; // 0..100 native Iranian copywriting craft scored by deepseek-flash
  creativeSharpness?: number; // legacy optional field
  briefFidelity?: number; // 0..100 V5 3-second product & core-offer fidelity (prevents off-brief drift!)
  factVerified: boolean;
  factIssues: string[];
  redPenNote: string;
  wasPolished: boolean;
}

export interface FunnelCandidate {
  id: string;
  director: string;
  strategy: string;
  ad: AdCopy;
  headlineStopPct: number;
  tournamentSharePct?: number; // V4 order-rotated multi-variant tournament vote share %
  persianCraft: number;
  creativeSharpness?: number;
  factVerified: boolean;
  redPenNote: string;
  selected: boolean;
}

export interface CompetitorFeedAd {
  brand: string;
  headline: string;
  body: string;
}

export interface FeedBattleResult {
  competitors: CompetitorFeedAd[];
  originalSharePct: number;
  championSharePct: number;
  shareLiftPct: number;
  competitorAvgPct: number;
  originalNeitherPct: number;
  championNeitherPct: number;
  voterCount: number;
}

export interface SimulatedComment {
  personaId: string;
  name: string;
  age: number;
  city: string;
  job: string;
  tone: "skeptic" | "troll" | "price_check" | "curious" | "buyer";
  comment: string;
  suggestedReply: string;
}

export interface LaunchKit {
  storyFrames: Array<{
    frame: number;
    role: string;
    visualNote: string;
    text: string;
    sticker?: string;
  }>;
  reelsHook: {
    seconds0to3: string;
    visualAction: string;
    caption: string;
  };
  telegramPost: {
    headline: string;
    body: string;
    cta: string;
  };
  yektanetAd: {
    title: string;
    subtitle: string;
    cta: string;
  };
}

export interface PriceOfferOption {
  id: string;
  label: string;
  priceToman: number; // effective revenue per buyer in Toman (e.g. 190000 or 490000)
  offerHeadline: string;
  offerDetails: string;
  cta: string;
}

export interface PriceOfferEval {
  offer: PriceOfferOption;
  clickPct: number;
  intentPct: number;
  trustPct: number;
  priceShockPct: number;
  preferenceSharePct?: number; // V4 direct order-rotated multi-offer choice share %
  expectedRpmToman: number; // realistic cold-traffic expected revenue per 1,000 ad impressions (in Toman)
  byIncome: Array<{
    tier: string;
    count: number;
    intentPct: number;
    priceShockPct: number;
  }>;
}

export interface PriceElasticityResult {
  crowdCount: number;
  offers: PriceOfferEval[];
  bestConversionId: string;
  bestRevenueId: string;
  insightSummary: string;
  totalCostUsd: number;
  durationMs: number;
}

export interface Persona {
  id: string;
  name: string;
  gender: "زن" | "مرد";
  age: number;
  province: string;
  city: string;
  neighborhood: string;
  city_tier: "تهران" | "کلان‌شهر" | "مرکز استان" | "شهرستان";
  regional_flavor?: string;
  job: string;
  sector: string;
  monthly_income_m: number;
  income_tier: string;
  marital_status: string;
  housing: string;
  platforms: string[];
  payment_habit: string;
  ad_archetype: string;
  ad_archetype_desc?: string;
  ad_skepticism: number; // 1..5
  avatar_hue: number;
  life_story: string;
  voice_sample: string;
  triggers: string[];
  red_flags: string[];
  custom_tag?: string;
}

export interface AdCopy {
  headline: string;
  body: string;
  cta: string;
  platform?: "instagram" | "instagram_story" | "instagram_reels" | "telegram" | "divar" | "banner";
  voiceRegister?: VoiceRegister;
  imageDataUrl?: string; // optional base64 PNG/JPEG/WebP data URL for multimodal judging
}

export interface PersonJudgment {
  personaId: string;
  name: string;
  age: number;
  gender: "زن" | "مرد";
  city: string;
  neighborhood: string;
  city_tier: string;
  job: string;
  income_tier: string;
  monthly_income_m: number;
  ad_archetype: string;
  stop: number; // 0..1 (relevance-gated headline thumb-stop)
  relevance?: number; // 0..1 (V5 personal category/product fit for THIS specific Iranian persona)
  click: number; // 0..1 (V5 multiplicative funnel pull: stop * pull * clarity * trust)
  intent: number; // 0..1 (raw persuasion/pull given stopped)
  trust: number; // 0..1
  naturalness?: number; // 0..1
  clarity: number; // 0..1 (3-second product & offer clarity)
  reaction: ReactionType;
  fitness: number; // 0..100
}

export interface ClauseHeat {
  clause: string;
  score: number; // -2..+2
  kind: "headline" | "body" | "cta";
}

export interface ReactionCounts {
  annoyed: number;
  neutral: number;
  curious: number;
  excited: number;
}

export interface SegmentSummary {
  label: string;
  count: number;
  fitness: number;
  click: number;
  trust: number;
}

export interface FocusGroupQuote {
  personaId: string;
  name: string;
  age: number;
  city: string;
  job: string;
  reaction: ReactionType;
  clickPct: number;
  trustPct: number;
  quote: string;
}

export interface HeadToHeadResult {
  generation: number;
  championId: string;
  championHeadline: string;
  challengerId: string;
  challengerHeadline: string;
  championWinPct: number;
  challengerWinPct: number;
  tiePct?: number; // V6 tie-aware calibration
  neitherPct: number;
  voterCount: number;
  winner: "champion" | "challenger";
  promotedByDuel: boolean;
}

export interface SocialContagionResult {
  baselineTrustPct: number;
  baselineClickPct: number;
  darkSocialSharePct: number; // % likely to forward in Telegram/IG DM
  underAttackTrustPct: number;
  underAttackClickPct: number;
  trustDropPct: number; // negative when comments hurt trust
  clickDropPct: number;
  afterReplyTrustPct: number;
  afterReplyClickPct: number;
  trustRecoveryPct: number; // positive when admin replies recover trust
  clickRecoveryPct: number;
  voterCount: number;
  attackCommentCount: number;
  repliesOptimized?: boolean; // V7 closed-loop verified admin reply upgrade
  transparencyGapWarning?: string; // V7 flagged when even optimized replies cannot recover trust due to missing product facts
}

export interface BattleContenderInput {
  id: string;
  label: string;
  ad: AdCopy;
}

export interface BattleContenderResult {
  id: string;
  label: string;
  ad: AdCopy;
  tournamentSharePct: number;
  fitness: number;
  fitnessStd: number;
  estCtrPct: number;
  relevance: number;
  stop: number;
  clarity: number;
  trust: number;
  click: number;
  reactions: ReactionCounts;
  bottleneck: string;
  segmentsByArchetype: SegmentSummary[];
  segmentsByCityTier: SegmentSummary[];
  segmentsByIncome: SegmentSummary[];
}

export interface BattleResult {
  platform: NonNullable<AdCopy["platform"]>;
  crowdCount: number;
  nonePct: number;
  winnerId: string;
  verdictSummary: string;
  contenders: BattleContenderResult[];
  archetypeMatrix: Array<{
    archetype: string;
    count: number;
    shares: Record<string, number>; // contenderId -> vote share %
    winnerId: string;
  }>;
  totalTokens: number;
  totalCostUsd: number;
  durationMs: number;
}

export interface CounterfactualXrayResult {
  originalScore: number;
  hookOnlyScore: number; // Champion Headline + Original Body/CTA
  offerOnlyScore: number; // Original Headline + Champion Body/CTA
  championScore: number;
  hookLift: number;
  offerLift: number;
  synergyLift: number;
  hookSharePct: number; // % of total lift attributable to Headline Hook
  offerSharePct: number; // % of total lift attributable to Body/Offer/CTA
  tightIcpScore: number;
  broadOutsideScore: number | null; // null if no personas outside filter
  broadGap: number | null;
  scaleVerdict: string;
  voterCount: number;
}

export interface SegmentWinner {
  group: "city" | "income" | "age" | "archetype";
  groupLabel: string;
  segment: string;
  count: number;
  winnerId: string;
  winnerHeadline: string;
  winnerStrategy: string;
  winnerFitness: number;
  overallChampionFitness: number;
  marginOverChampion: number;
}

export interface SplitCampaignAdvice {
  shouldSplit: boolean;
  summary: string;
  winners: SegmentWinner[];
}

export interface VariantResult {
  id: string;
  generation: number; // 0 = original
  strategy: string;
  director?: string; // Creative Room director role (V3)
  stage?: "original" | "diverge" | "crossover" | "polish";
  ad: AdCopy;
  fitness: number;
  fitnessStd?: number; // V5 genuine human spread across personas (e.g. 10..20, NOT fake 1.7!)
  relevance?: number; // 0..100 V5 personal category/product fit across crowd
  estCtrPct?: number; // V5 grounded cold-feed Instagram CTR estimate (0.4%..4.2%)
  stop: number; // 0..100
  click: number; // 0..100
  intent: number; // 0..100
  trust: number; // 0..100
  naturalness?: number; // 0..100
  brandCraft?: number; // 0..100 (V5 Persian craft + brief fidelity hygiene score)
  antiStreisand?: number; // 0..100 (confident vs defensive/paranoid)
  copyChief?: CopyChiefReview; // deepseek-flash Persian Copy Chief + Fact & Brief Fidelity Audit
  clarity: number; // 0..100 (3-second product & offer clarity)
  reactions: ReactionCounts;
  judgments: PersonJudgment[];
  heatmap?: ClauseHeat[];
  segmentsByCityTier: SegmentSummary[];
  segmentsByIncome: SegmentSummary[];
  segmentsByArchetype?: SegmentSummary[]; // V5 real buyer-mindset reaction split
  latencyMs: number;
  inputTokens: number;
  costUsd: number;
  isChampion?: boolean;
}

export interface GenerationDiagnosis {
  generation: number;
  stage?: "diverge" | "crossover" | "polish";
  diagnosis: string;
  objections: string[];
  landingPageTips?: string[];
  focusGroupQuotes?: FocusGroupQuote[];
  heatmap: ClauseHeat[];
}

export interface AudienceFilters {
  cityTiers?: string[];
  incomeTiers?: string[];
  gender?: "all" | "زن" | "مرد";
  minAge?: number;
  maxAge?: number;
  sectors?: string[];
  archetypes?: string[];
  customTag?: string;
}

export interface EvolveRequest {
  ad: AdCopy;
  productTruth: string;
  voiceRegister?: VoiceRegister;
  reasoningMode?: ReasoningMode; // "max" (default) or "high" — always deepseek-flash
  enableFeedBattle?: boolean; // default true
  competitorContext?: string; // optional competitor names/pitches
  filters: AudienceFilters;
  crowdSize: number;
  holdoutSize: number;
  generations: number; // 0..4
  variantsPerGen: number; // 2..4
}

export interface HoldoutResult {
  original: VariantResult;
  champion: VariantResult;
  fitnessLift: number;
  clickLift: number;
  trustLift: number;
  ci95Low?: number;
  ci95High?: number;
  pValue?: number;
  winRatePct?: number; // % of unseen individuals who scored Champion higher than Original
  statisticallySignificant?: boolean;
  headToHead?: {
    championWinPct: number;
    originalWinPct: number;
    tiePct?: number;
    neitherPct: number;
  };
}

export interface EvolutionRun {
  id: string;
  createdAt: string;
  title: string;
  productTruth: string;
  voiceRegister?: VoiceRegister;
  reasoningMode?: ReasoningMode;
  filters: AudienceFilters;
  trainCount: number;
  holdoutCount: number;
  generationsRequested: number;
  original: VariantResult;
  champion: VariantResult;
  variants: VariantResult[];
  diagnoses: GenerationDiagnosis[];
  funnelCandidates?: FunnelCandidate[];
  championHistory: Array<{ gen: number; label: string; fitness: number; variantId: string }>;
  headToHead?: HeadToHeadResult[];
  splitAdvice?: SplitCampaignAdvice;
  holdout?: HoldoutResult;
  feedBattle?: FeedBattleResult;
  simulatedComments?: SimulatedComment[];
  socialContagion?: SocialContagionResult;
  counterfactualXray?: CounterfactualXrayResult;
  launchKit?: LaunchKit;
  totalTokens: number;
  totalCostUsd: number;
  totalDurationMs: number;
}

export type EvolveSSEEvent =
  | {
      type: "init";
      runId: string;
      trainCount: number;
      holdoutCount: number;
      totalMatched: number;
      trainPersonas: Array<Pick<Persona, "id" | "name" | "city" | "neighborhood" | "age" | "job" | "ad_archetype" | "income_tier">>;
    }
  | {
      type: "phase";
      phase:
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
        | "done";
      generation: number;
      message: string;
      variantId?: string;
      variantLabel?: string;
      totalToJudge?: number;
    }
  | {
      type: "wave";
      variantId: string;
      phase: "train" | "holdout_orig" | "holdout_champ";
      completed: number;
      total: number;
      batch: PersonJudgment[];
      runningMetrics: {
        fitness: number;
        stop: number;
        click: number;
        intent: number;
        trust: number;
        naturalness: number;
        clarity: number;
        reactions: ReactionCounts;
      };
    }
  | { type: "heatmap"; variantId: string; generation: number; heatmap: ClauseHeat[] }
  | { type: "focus_group"; generation: number; quotes: FocusGroupQuote[] }
  | { type: "creative_room"; candidates: FunnelCandidate[] }
  | {
      type: "diagnosis";
      generation: number;
      stage?: "diverge" | "crossover" | "polish";
      diagnosis: string;
      objections: string[];
      landingPageTips?: string[];
      focusGroupQuotes?: FocusGroupQuote[];
      plannedVariants: Array<{ strategy: string; ad: AdCopy }>;
    }
  | {
      type: "variant_done";
      variant: VariantResult;
      isNewChampion: boolean;
      champion: VariantResult;
      championHistory: EvolutionRun["championHistory"];
    }
  | {
      type: "head_to_head";
      result: HeadToHeadResult;
      champion: VariantResult;
      championHistory: EvolutionRun["championHistory"];
    }
  | { type: "holdout_done"; holdout: HoldoutResult }
  | { type: "feed_battle"; result: FeedBattleResult }
  | { type: "comments_ready"; comments: SimulatedComment[] }
  | { type: "social_contagion"; result: SocialContagionResult }
  | { type: "counterfactual_xray"; result: CounterfactualXrayResult }
  | { type: "complete"; run: EvolutionRun }
  | { type: "error"; message: string };
