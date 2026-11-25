import { NextRequest } from "next/server";
import { filterCrowd, loadCrowd, saveRun, splitTrainAndHoldout } from "@/lib/crowd-store";
import {
  computeCopyHeatmap,
  computePairedHoldoutStats,
  computeSplitCampaignAdvice,
  evaluateCounterfactualXray,
  evaluateCrowdStreaming,
  evaluateFeedBattle,
  evaluateHeadToHead,
  evaluateSocialContagion,
  runRotatedTournament,
  scoreCommentRepliesOnly,
  screenHeadlinesFast,
} from "@/lib/decider";
import {
  auditAndPolishWithCopyChief,
  generateCompetitorFeedAds,
  mutateAdWithDiagnostics,
  optimizeAdminReplies,
  runCreativeRoomGen1,
  runMiniFocusGroup,
  simulateInstagramComments,
} from "@/lib/deepseek";
import type {
  AdCopy,
  CopyChiefReview,
  CounterfactualXrayResult,
  EvolutionRun,
  EvolveRequest,
  EvolveSSEEvent,
  FeedBattleResult,
  FunnelCandidate,
  GenerationDiagnosis,
  HeadToHeadResult,
  Persona,
  ReasoningMode,
  SimulatedComment,
  SocialContagionResult,
  VariantResult,
  VoiceRegister,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function normalizeHeadline(s: string): string {
  return s
    .replace(/[\u200c\s.!؟?،,:؛«»"'()-]+/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .toLowerCase();
}

function tokenizePersian(s: string): Set<string> {
  const stopWords = new Set(["را", "رو", "در", "به", "از", "با", "برای", "و", "که", "این", "آن", "یک", "یه", "هم", "است", "هست", "تا", "بر", "یا"]);
  const cleaned = s
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[.!؟?،,:؛«»"'()\-–—]/g, " ")
    .toLowerCase();
  const toks = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/\u200c/g, "").trim())
    .filter((t) => t.length >= 2 && !stopWords.has(t));
  return new Set(toks);
}

/** Jaccard token similarity to prevent near-identical headlines across directors */
function headlineSimilarity(a: string, b: string): number {
  const ta = tokenizePersian(a);
  const tb = tokenizePersian(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union > 0 ? inter / union : 0;
}

/** Normalized 3-word opening prefix to kill template clones like "با میلی قسطی..." */
function openingPrefix3(s: string): string {
  return s
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[.!؟?،,:؛«»"'()\-–—]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
}

export async function POST(req: NextRequest) {
  let body: EvolveRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "بدنه درخواست نامعتبر است" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: EvolveSSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };

      const startedAt = Date.now();
      let totalTokens = 0;
      let totalCostUsd = 0;

      try {
        const voiceRegister: VoiceRegister = body.voiceRegister ?? body.ad?.voiceRegister ?? "colloquial";
        const reasoningMode: ReasoningMode = body.reasoningMode === "high" ? "high" : "max";
        const enableFeedBattle = body.enableFeedBattle !== false;
        const competitorContext = String(body.competitorContext ?? "").trim();

        const ad: AdCopy = {
          headline: String(body.ad?.headline ?? "").trim(),
          body: String(body.ad?.body ?? "").trim(),
          cta: String(body.ad?.cta ?? "").trim(),
          platform: body.ad?.platform ?? "instagram",
          voiceRegister,
          imageDataUrl: body.ad?.imageDataUrl || undefined,
        };
        if (!ad.headline || !ad.body) {
          throw new Error("تیتر و متن تبلیغ الزامی است.");
        }

        const allCrowd = loadCrowd();
        const matched = filterCrowd(allCrowd, body.filters);
        if (matched.length < 10) {
          throw new Error(
            `تعداد مخاطبان مطابق فیلتر شما (${matched.length} نفر) کمتر از حداقل ۱۰ نفر است. فیلترها را بازتر کنید.`
          );
        }

        const reqTrain = Math.min(350, Math.max(12, Number(body.crowdSize ?? 60)));
        const reqHoldout = Math.min(200, Math.max(8, Number(body.holdoutSize ?? 48)));
        const generations = Math.min(4, Math.max(0, Number(body.generations ?? 3)));
        const variantsPerGen = Math.min(4, Math.max(2, Number(body.variantsPerGen ?? 2)));
        const productTruth = String(body.productTruth ?? "").trim();

        const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const { train, holdout } = splitTrainAndHoldout(matched, reqTrain, reqHoldout);

        send({
          type: "init",
          runId,
          trainCount: train.length,
          holdoutCount: holdout.length,
          totalMatched: matched.length,
          trainPersonas: train.map((p) => ({
            id: p.id,
            name: p.name,
            city: p.city,
            neighborhood: p.neighborhood,
            age: p.age,
            job: p.job,
            ad_archetype: p.ad_archetype,
            income_tier: p.income_tier,
          })),
        });

        const personaById = new Map<string, Persona>(matched.map((p) => [p.id, p]));
        const allVariants: VariantResult[] = [];
        const diagnoses: GenerationDiagnosis[] = [];
        const championHistory: EvolutionRun["championHistory"] = [];
        const headToHeadResults: HeadToHeadResult[] = [];
        let funnelCandidates: FunnelCandidate[] | undefined;
        const seenHeadlines = new Set<string>([normalizeHeadline(ad.headline)]);

        // Kick off Competitor Feed Ads & g0 Read-Only Audit in parallel from t=0s (saves ~12s!)
        const competitorPromise =
          enableFeedBattle && generations > 0
            ? generateCompetitorFeedAds({ ad, productTruth, competitorContext }).catch(() => null)
            : Promise.resolve(null);

        const origAuditPromise = auditAndPolishWithCopyChief({
          candidates: [{ director: "نسخه اصلی", strategy: "نسخه اصلی", ad }],
          originalAd: ad,
          productTruth,
          voiceRegister,
          reasoningMode,
          readOnly: true,
        }).catch(() => null);

        // ---------- Generation 0: Original Ad ----------
        send({
          type: "phase",
          phase: "orig",
          generation: 0,
          variantId: "g0",
          variantLabel: "نسخه اصلی",
          totalToJudge: train.length,
          message: `تست دو مرحله‌ای (توقف تیتر + قضاوت انسانی + ممیزی بریف) روی ${train.length} نفر برای نسخه اصلی...`,
        });

        const [origAuditRes, origEval] = await Promise.all([
          origAuditPromise,
          evaluateCrowdStreaming(
            "g0",
            0,
            "نسخه اصلی",
            ad,
            train,
            (batch, completed, total, running) => {
              send({
                type: "wave",
                variantId: "g0",
                phase: "train",
                completed,
                total,
                batch,
                runningMetrics: {
                  fitness: running.fitness,
                  stop: running.stop,
                  click: running.click,
                  intent: running.intent,
                  trust: running.trust,
                  naturalness: running.naturalness,
                  clarity: running.clarity,
                  reactions: running.reactions,
                },
              });
            },
            "original"
          ),
        ]);
        const origCopyChief = origAuditRes?.audited[0]?.review;
        if (origAuditRes) {
          totalTokens += origAuditRes.tokens;
          totalCostUsd += origAuditRes.costUsd;
        }
        if (origCopyChief) {
          origEval.copyChief = origCopyChief;
        }
        totalTokens += origEval.inputTokens;
        totalCostUsd += origEval.costUsd;

        const sortedOrig = [...origEval.judgments].sort((a, b) => a.fitness - b.fitness);
        const heatSample = [
          ...sortedOrig.slice(0, 3),
          ...sortedOrig.slice(Math.floor(sortedOrig.length / 2), Math.floor(sortedOrig.length / 2) + 2),
          sortedOrig[sortedOrig.length - 1],
        ]
          .map((j) => personaById.get(j.personaId)!)
          .filter(Boolean);

        const g0Heat = await computeCopyHeatmap(ad, heatSample);
        totalTokens += g0Heat.inputTokens;
        totalCostUsd += (g0Heat.inputTokens * 0.02) / 1_000_000;
        origEval.heatmap = g0Heat.heatmap;
        origEval.isChampion = true;

        send({ type: "heatmap", variantId: "g0", generation: 0, heatmap: g0Heat.heatmap });

        let champion: VariantResult = origEval;
        allVariants.push(origEval);
        championHistory.push({ gen: 0, label: "اصلی", fitness: origEval.fitness, variantId: "g0" });

        send({
          type: "variant_done",
          variant: origEval,
          isNewChampion: true,
          champion,
          championHistory: [...championHistory],
        });

        // ---------- Generations 1..N ----------
        for (let gen = 1; gen <= generations; gen++) {
          // Live Mini-Focus Group on Persuadable Middle
          send({
            type: "phase",
            phase: "focus_group",
            generation: gen,
            message: `مصاحبه زنده با ۴ مخاطب قابل‌جذب برای کشف اهرم کشش نسل ${gen}...`,
          });

          const persuadable = [...champion.judgments]
            .sort((a, b) => Math.abs(a.fitness - 55) - Math.abs(b.fitness - 55))
            .slice(0, 2);
          const warmCritics = [...champion.judgments]
            .filter((j) => !persuadable.some((s) => s.personaId === j.personaId))
            .sort((a, b) => Math.abs(a.fitness - 38) - Math.abs(b.fitness - 38))
            .slice(0, 2);

          const interviewTargets = [...persuadable, ...warmCritics]
            .map((j) => ({ persona: personaById.get(j.personaId)!, judgment: j }))
            .filter((x) => Boolean(x.persona));

          const fg = await runMiniFocusGroup({ ad: champion.ad, targets: interviewTargets });
          totalTokens += fg.tokens;
          totalCostUsd += fg.costUsd;

          send({ type: "focus_group", generation: gen, quotes: fg.quotes });

          const currentHeat = champion.heatmap ?? g0Heat.heatmap;
          let selectedCandidates: Array<{
            director?: string;
            strategy: string;
            ad: AdCopy;
            review: CopyChiefReview;
          }> = [];
          let stage: "diverge" | "crossover" | "polish" =
            gen === 1 ? "diverge" : gen === 2 ? "crossover" : "polish";
          let diagText = "";
          let diagObjections: string[] = [];
          let diagLandingTips: string[] = [];

          if (gen === 1) {
            // ===== SYSTEM 1: 4-Director Parallel Creative Room (8 Concepts in Parallel!) =====
            send({
              type: "phase",
              phase: "creative_room",
              generation: 1,
              message: `اتاق خلاقیت ۴ کارگردان ایرانی (deepseek-flash · ${reasoningMode}): تولید همزمان ۸ زاویه مستقل...`,
            });

            const room = await runCreativeRoomGen1({
              original: origEval,
              heatmap: currentHeat,
              focusGroupQuotes: fg.quotes,
              productTruth,
              voiceRegister,
              reasoningMode,
            });
            totalTokens += room.tokens;
            totalCostUsd += room.costUsd;
            diagText = room.diagnosis;
            diagObjections = room.objections;
            diagLandingTips = room.landingPageTips;

            // ===== SYSTEM 2: Adversarial Copy Chief + Zero-Hallucination Fact Audit =====
            send({
              type: "phase",
              phase: "copy_chief",
              generation: 1,
              message: `سردبیر کپی و ممیز واقعیت در حال جراحی زبانی و ضدتوهم ${room.concepts.length} ایده...`,
            });

            const chief = await auditAndPolishWithCopyChief({
              candidates: room.concepts,
              originalAd: ad,
              productTruth,
              voiceRegister,
              reasoningMode,
            });
            totalTokens += chief.tokens;
            totalCostUsd += chief.costUsd;

            // Deduplicate audited concepts (exact + 3-word opening prefix clone + Jaccard > 0.52!)
            const acceptedHeadlines: string[] = [ad.headline];
            const acceptedPrefixes = new Set<string>([openingPrefix3(ad.headline)]);
            const uniqueAudited = chief.audited.filter((item) => {
              const key = normalizeHeadline(item.ad.headline);
              if (!key || seenHeadlines.has(key)) return false;
              const pref = openingPrefix3(item.ad.headline);
              if (pref.length >= 6 && acceptedPrefixes.has(pref)) return false;
              const tooClose = acceptedHeadlines.some((h) => headlineSimilarity(h, item.ad.headline) > 0.52);
              if (tooClose) return false;
              seenHeadlines.add(key);
              acceptedHeadlines.push(item.ad.headline);
              if (pref.length >= 6) acceptedPrefixes.add(pref);
              return true;
            });
            // Safety fallback if aggressive dedup filtered everything
            const funnelInput = uniqueAudited.length >= 2 ? uniqueAudited : chief.audited;

            // ===== SYSTEM 3 (V4 Order-Rotated 8-Way Tournament + Headline Stop Funnel!) =====
            send({
              type: "phase",
              phase: "funnel_screen",
              generation: 1,
              message: `تورنمنت رو‌در‌روی ${funnelInput.length} ایده روی ${Math.min(48, train.length)} مخاطب هدف (بدون سوگیری ترتیب) برای انتخاب فینالیست‌ها...`,
            });

            const [tourneyRes, screenRes] = await Promise.all([
              runRotatedTournament(funnelInput, train, ad.headline.slice(0, 60)),
              screenHeadlinesFast(funnelInput, train),
            ]);
            totalTokens += tourneyRes.inputTokens + screenRes.inputTokens;
            totalCostUsd += ((tourneyRes.inputTokens + screenRes.inputTokens) * 0.02) / 1_000_000;

            const maxTourney = Math.max(1, ...tourneyRes.voteSharePcts);

            // V5 Real-Crowd Funnel Score:
            // Order-Rotated Real Crowd Tournament Share (65%) + Headline Stop (20%) + Brief Fidelity & Craft (15%)
            const scored = funnelInput.map((item, idx) => {
              const stopPct = screenRes.stopPcts[idx] ?? 35;
              const votePct = tourneyRes.voteSharePcts[idx] ?? 0;
              const tourneyNorm = (votePct / maxTourney) * 100;
              const briefFid = item.review.briefFidelity ?? 88;
              const driftPen = briefFid < 65 ? (65 - briefFid) * 0.7 : 0;
              const funnelScore =
                tourneyNorm * 0.65 +
                stopPct * 0.20 +
                (briefFid * 0.5 + item.review.persianCraft * 0.5) * 0.15 -
                (item.review.factVerified ? 0 : 28) -
                driftPen;
              return { item, stopPct, votePct, briefFid, funnelScore, idx };
            });
            scored.sort((a, b) => b.funnelScore - a.funnelScore);

            // Pick top `gen1Keep` ensuring diversity across directors first!
            const gen1Keep = Math.min(scored.length, Math.max(3, variantsPerGen));
            const pickedIndices = new Set<number>();
            const usedDirectors = new Set<string>();

            // Pass 1: top winner from distinct directors
            for (const s of scored) {
              if (pickedIndices.size >= gen1Keep) break;
              const d = s.item.director ?? "عمومی";
              if (!usedDirectors.has(d)) {
                pickedIndices.add(s.idx);
                usedDirectors.add(d);
              }
            }
            // Pass 2: fill remaining slots by highest funnel score
            for (const s of scored) {
              if (pickedIndices.size >= gen1Keep) break;
              pickedIndices.add(s.idx);
            }

            funnelCandidates = scored.map((s, rank) => ({
              id: `f1_${rank + 1}`,
              director: s.item.director ?? "کارگردان خلاقیت",
              strategy: s.item.strategy,
              ad: s.item.ad,
              headlineStopPct: s.stopPct,
              tournamentSharePct: s.votePct,
              persianCraft: s.item.review.persianCraft,
              creativeSharpness: s.briefFid,
              factVerified: s.item.review.factVerified,
              redPenNote: s.item.review.redPenNote,
              selected: pickedIndices.has(s.idx),
            }));

            send({ type: "creative_room", candidates: funnelCandidates });

            selectedCandidates = scored
              .filter((s) => pickedIndices.has(s.idx))
              .map((s) => s.item);
          } else {
            // ===== GEN 2+ (MAP-Elites Crossover & Agency Polish + Copy Chief Audit) =====
            const stageLabel = gen === 2 ? "ترکیب ژنتیکی نخبگان (MAP-Elites)" : "صیقل نهایی آژانس و دوئل قهرمانی";
            send({
              type: "phase",
              phase: "mutating",
              generation: gen,
              message: `نسل ${gen} (${stageLabel} · deepseek-flash ${reasoningMode}): طراحی ${variantsPerGen} فینالیست...`,
            });

            const mutation = await mutateAdWithDiagnostics({
              champion,
              allVariants,
              heatmap: currentHeat,
              focusGroupQuotes: fg.quotes,
              productTruth,
              voiceRegister,
              reasoningMode,
              generation: gen,
              variantsPerGen,
            });
            totalTokens += mutation.tokens;
            totalCostUsd += mutation.costUsd;
            stage = mutation.stage;
            diagText = mutation.diagnosis;
            diagObjections = mutation.objections;
            diagLandingTips = mutation.landingPageTips;

            send({
              type: "phase",
              phase: "copy_chief",
              generation: gen,
              message: `سردبیر کپی در حال ممیزی فارسی بومی و تطابق واقعیت فینالیست‌های نسل ${gen}...`,
            });

            const chief = await auditAndPolishWithCopyChief({
              candidates: mutation.variants,
              originalAd: ad,
              productTruth,
              voiceRegister,
              reasoningMode,
            });
            totalTokens += chief.tokens;
            totalCostUsd += chief.costUsd;

            const deduped = chief.audited.filter((item) => {
              const key = normalizeHeadline(item.ad.headline);
              if (seenHeadlines.has(key)) return false;
              seenHeadlines.add(key);
              return true;
            });
            selectedCandidates = deduped.length > 0 ? deduped : chief.audited.slice(0, variantsPerGen);
          }

          diagnoses.push({
            generation: gen,
            stage,
            diagnosis: diagText,
            objections: diagObjections,
            landingPageTips: diagLandingTips,
            focusGroupQuotes: fg.quotes,
            heatmap: currentHeat,
          });

          send({
            type: "diagnosis",
            generation: gen,
            stage,
            diagnosis: diagText,
            objections: diagObjections,
            landingPageTips: diagLandingTips,
            focusGroupQuotes: fg.quotes,
            plannedVariants: selectedCandidates.map((c) => ({ strategy: c.strategy, ad: c.ad })),
          });

          const genVariants: VariantResult[] = [];
          const prevChampBeforeGen = champion;

          for (let vi = 0; vi < selectedCandidates.length; vi++) {
            const candidate = selectedCandidates[vi];
            const varId = `g${gen}_v${vi + 1}`;

            send({
              type: "phase",
              phase: "judging",
              generation: gen,
              variantId: varId,
              variantLabel: `نسل ${gen} · ${candidate.director ? `${candidate.director} — ` : ""}${candidate.strategy}`,
              totalToJudge: train.length,
              message: `جمعیت ${train.length} نفری در حال قضاوت نسخه ${vi + 1} از ${selectedCandidates.length} (نسل ${gen})...`,
            });

            const varEval = await evaluateCrowdStreaming(
              varId,
              gen,
              candidate.strategy,
              candidate.ad,
              train,
              (batch, completed, total, running) => {
                send({
                  type: "wave",
                  variantId: varId,
                  phase: "train",
                  completed,
                  total,
                  batch,
                  runningMetrics: {
                    fitness: running.fitness,
                    stop: running.stop,
                    click: running.click,
                    intent: running.intent,
                    trust: running.trust,
                    naturalness: running.naturalness,
                    clarity: running.clarity,
                    reactions: running.reactions,
                  },
                });
              },
              stage,
              { director: candidate.director, copyChief: candidate.review }
            );
            totalTokens += varEval.inputTokens;
            totalCostUsd += varEval.costUsd;

            const isNewChampion = varEval.fitness > champion.fitness;
            if (isNewChampion) {
              const vHeat = await computeCopyHeatmap(candidate.ad, heatSample);
              totalTokens += vHeat.inputTokens;
              totalCostUsd += (vHeat.inputTokens * 0.02) / 1_000_000;
              varEval.heatmap = vHeat.heatmap;
              send({ type: "heatmap", variantId: varId, generation: gen, heatmap: vHeat.heatmap });

              champion.isChampion = false;
              varEval.isChampion = true;
              champion = varEval;
            }

            allVariants.push(varEval);
            genVariants.push(varEval);

            send({
              type: "variant_done",
              variant: varEval,
              isNewChampion,
              champion,
              championHistory: [
                ...championHistory,
                { gen, label: `نسل ${gen}`, fitness: champion.fitness, variantId: champion.id },
              ],
            });
          }

          // Order-Balanced Pairwise Duel on Gen 2+ (or Gen 1 if top 2 are tight!)
          if (genVariants.length > 0) {
            const bestGenChallenger = [...genVariants]
              .filter((v) => v.id !== champion.id)
              .sort((a, b) => b.fitness - a.fitness)[0];

            const duelA = champion;
            const duelB =
              gen >= 2 && champion.generation === gen && prevChampBeforeGen.id !== champion.id
                ? prevChampBeforeGen
                : bestGenChallenger;

            if (duelB && (gen >= 2 || Math.abs(duelA.fitness - duelB.fitness) <= 10) && Math.abs(duelA.fitness - duelB.fitness) <= 20) {
              send({
                type: "phase",
                phase: "duel",
                generation: gen,
                message: `دوئل رو‌در‌رو (A در برابر B): ${train.length} نفر مستقیماً بین «${duelA.id}» و «${duelB.id}» رای می‌دهند...`,
              });

              const duel = await evaluateHeadToHead(duelA.ad, duelB.ad, train);
              totalTokens += duel.inputTokens;
              totalCostUsd += (duel.inputTokens * 0.02) / 1_000_000;

              const challengerWon = duel.bWinPct > duel.aWinPct + 3;
              let promotedByDuel = false;
              if (challengerWon) {
                champion.isChampion = false;
                duelB.isChampion = true;
                champion = duelB;
                promotedByDuel = true;
                if (!champion.heatmap) {
                  const vHeat = await computeCopyHeatmap(champion.ad, heatSample);
                  totalTokens += vHeat.inputTokens;
                  totalCostUsd += (vHeat.inputTokens * 0.02) / 1_000_000;
                  champion.heatmap = vHeat.heatmap;
                  send({ type: "heatmap", variantId: champion.id, generation: gen, heatmap: vHeat.heatmap });
                }
              }

              const h2h: HeadToHeadResult = {
                generation: gen,
                championId: duelA.id,
                championHeadline: duelA.ad.headline,
                challengerId: duelB.id,
                challengerHeadline: duelB.ad.headline,
                championWinPct: duel.aWinPct,
                challengerWinPct: duel.bWinPct,
                tiePct: duel.tiePct,
                neitherPct: duel.neitherPct,
                voterCount: duel.voterCount,
                winner: challengerWon ? "challenger" : "champion",
                promotedByDuel,
              };
              headToHeadResults.push(h2h);

              send({
                type: "head_to_head",
                result: h2h,
                champion,
                championHistory: [
                  ...championHistory,
                  { gen, label: `نسل ${gen}`, fitness: champion.fitness, variantId: champion.id },
                ],
              });
            }
          }

          championHistory.push({
            gen,
            label: `نسل ${gen}`,
            fitness: champion.fitness,
            variantId: champion.id,
          });
        }

        // Kick off Simulated Instagram Comments in parallel while Unseen Holdout runs! (Zero extra wait!)
        const champSorted = [...champion.judgments].sort((a, b) => a.fitness - b.fitness);
        const commentPicks = [
          ...champSorted.slice(0, 2), // toughest skeptics/trolls
          ...champSorted.slice(Math.floor(champSorted.length * 0.25), Math.floor(champSorted.length * 0.25) + 2),
          ...champSorted.slice(Math.floor(champSorted.length * 0.55), Math.floor(champSorted.length * 0.55) + 2),
          ...champSorted.slice(-2), // excited buyers
        ]
          .filter((j, idx, arr) => arr.findIndex((x) => x.personaId === j.personaId) === idx)
          .map((j) => ({ persona: personaById.get(j.personaId)!, judgment: j }))
          .filter((x) => Boolean(x.persona))
          .slice(0, 8);

        const commentsPromise =
          commentPicks.length >= 4
            ? simulateInstagramComments({ ad: champion.ad, productTruth, personas: commentPicks }).catch(() => null)
            : Promise.resolve(null);

        // ---------- Unseen Holdout Verification + Paired 95% CI & p-value ----------
        let holdoutResult: EvolutionRun["holdout"];
        if (holdout.length >= 4 && generations > 0) {
          send({
            type: "phase",
            phase: "holdout_orig",
            generation: generations + 1,
            variantId: "holdout_orig",
            variantLabel: "ارزیابی پنهان نسخه اصلی",
            totalToJudge: holdout.length,
            message: `تست پنهان (Holdout): ${holdout.length} مخاطب دیده‌نشده در حال قضاوت نسخه اصلی...`,
          });

          const hOrig = await evaluateCrowdStreaming(
            "holdout_orig",
            0,
            "نسخه اصلی (جمعیت پنهان)",
            ad,
            holdout,
            (batch, completed, total, running) => {
              send({
                type: "wave",
                variantId: "holdout_orig",
                phase: "holdout_orig",
                completed,
                total,
                batch,
                runningMetrics: {
                  fitness: running.fitness,
                  stop: running.stop,
                  click: running.click,
                  intent: running.intent,
                  trust: running.trust,
                  naturalness: running.naturalness,
                  clarity: running.clarity,
                  reactions: running.reactions,
                },
              });
            },
            "original",
            { director: "نسخه اصلی", copyChief: origCopyChief }
          );
          totalTokens += hOrig.inputTokens;
          totalCostUsd += hOrig.costUsd;

          send({
            type: "phase",
            phase: "holdout_champ",
            generation: generations + 1,
            variantId: "holdout_champ",
            variantLabel: "ارزیابی پنهان قهرمان نهایی",
            totalToJudge: holdout.length,
            message: `تست پنهان (Holdout): همان ${holdout.length} مخاطب دیده‌نشده در حال قضاوت قهرمان نهایی...`,
          });

          const hChamp = await evaluateCrowdStreaming(
            "holdout_champ",
            champion.generation,
            `قهرمان نسل ${champion.generation} (جمعیت پنهان)`,
            champion.ad,
            holdout,
            (batch, completed, total, running) => {
              send({
                type: "wave",
                variantId: "holdout_champ",
                phase: "holdout_champ",
                completed,
                total,
                batch,
                runningMetrics: {
                  fitness: running.fitness,
                  stop: running.stop,
                  click: running.click,
                  intent: running.intent,
                  trust: running.trust,
                  naturalness: running.naturalness,
                  clarity: running.clarity,
                  reactions: running.reactions,
                },
              });
            },
            champion.stage,
            { director: champion.director, copyChief: champion.copyChief }
          );
          totalTokens += hChamp.inputTokens;
          totalCostUsd += hChamp.costUsd;

          const hDuel = await evaluateHeadToHead(ad, champion.ad, holdout);
          totalTokens += hDuel.inputTokens;
          totalCostUsd += (hDuel.inputTokens * 0.02) / 1_000_000;

          const pairedStats = computePairedHoldoutStats(hOrig.judgments, hChamp.judgments);

          holdoutResult = {
            original: hOrig,
            champion: hChamp,
            fitnessLift: Number((hChamp.fitness - hOrig.fitness).toFixed(1)),
            clickLift: Number((hChamp.click - hOrig.click).toFixed(1)),
            trustLift: Number((hChamp.trust - hOrig.trust).toFixed(1)),
            ci95Low: pairedStats.ci95Low,
            ci95High: pairedStats.ci95High,
            pValue: pairedStats.pValue,
            winRatePct: pairedStats.winRatePct,
            statisticallySignificant: pairedStats.statisticallySignificant,
            headToHead: {
              originalWinPct: hDuel.aWinPct,
              championWinPct: hDuel.bWinPct,
              tiePct: hDuel.tiePct,
              neitherPct: hDuel.neitherPct,
            },
          };
          send({ type: "holdout_done", holdout: holdoutResult });
        }

        // ---------- SYSTEM 4 + V6 COUNTERFACTUAL X-RAY (Parallel!) ----------
        let feedBattleResult: FeedBattleResult | undefined;
        let counterfactualXray: CounterfactualXrayResult | undefined;
        const compGen = await competitorPromise;

        const feedVoters = [...holdout, ...train].slice(0, 48);
        const matchedIds = new Set(matched.map((p) => p.id));
        const broadOutside = allCrowd.filter((p) => !matchedIds.has(p.id)).slice(0, 24);
        const xrayIcp = (holdout.length >= 12 ? holdout : train).slice(0, 24);

        if (generations > 0) {
          send({
            type: "phase",
            phase: "feed_battle",
            generation: generations + 1,
            message: `آزمون شلوغی فید واقعی + کالبدشکافی علّی (تیتر در برابر پیشنهاد + مقیاس‌پذیری)...`,
          });

          const [fb, xray] = await Promise.all([
            compGen && compGen.competitors.length >= 2
              ? evaluateFeedBattle(ad, champion.ad, compGen.competitors, feedVoters).catch(() => null)
              : Promise.resolve(null),
            champion.id !== origEval.id
              ? evaluateCounterfactualXray(ad, champion.ad, xrayIcp, broadOutside).catch(() => null)
              : Promise.resolve(null),
          ]);

          if (compGen) {
            totalTokens += compGen.tokens;
            totalCostUsd += compGen.costUsd;
          }
          if (fb) {
            totalTokens += fb.inputTokens;
            totalCostUsd += (fb.inputTokens * 0.02) / 1_000_000;
            feedBattleResult = fb.result;
            send({ type: "feed_battle", result: feedBattleResult });
          }
          if (xray) {
            totalTokens += xray.inputTokens;
            totalCostUsd += (xray.inputTokens * 0.02) / 1_000_000;
            counterfactualXray = xray.result;
            send({ type: "counterfactual_xray", result: counterfactualXray });
          }
        }

        // ---------- SYSTEM 5 + V6 2ND-ORDER SOCIAL CONTAGION (Comment Attack -> Admin Recovery + Dark-Social Share) ----------
        let simulatedComments: SimulatedComment[] | undefined;
        let socialContagion: SocialContagionResult | undefined;
        const commRes = await commentsPromise;
        if (commRes && commRes.comments.length > 0) {
          totalTokens += commRes.tokens;
          totalCostUsd += commRes.costUsd;
          simulatedComments = commRes.comments;
          send({ type: "comments_ready", comments: simulatedComments });

          const contagionVoters = (holdout.length >= 16 ? holdout : [...holdout, ...train]).slice(0, 28);
          const cont = await evaluateSocialContagion(champion.ad, simulatedComments, contagionVoters).catch(() => null);
          if (cont) {
            totalTokens += cont.inputTokens;
            totalCostUsd += (cont.inputTokens * 0.02) / 1_000_000;
            socialContagion = cont.result;

            // V7 Verified Closed-Loop Admin Reply Upgrade + Transparency Gap Detector:
            // If initial Admin Replies fail to recover >= 70% of baseline trust, optimize & re-verify!
            if (
              socialContagion.baselineTrustPct >= 25 &&
              socialContagion.afterReplyTrustPct < socialContagion.baselineTrustPct * 0.70
            ) {
              const prio: Record<SimulatedComment["tone"], number> = {
                troll: 0,
                skeptic: 1,
                price_check: 2,
                curious: 3,
                buyer: 4,
              };
              const indexed = simulatedComments
                .map((c, idx) => ({ c, idx }))
                .sort((a, b) => (prio[a.c.tone] ?? 9) - (prio[b.c.tone] ?? 9))
                .slice(0, 3);

              const opt = await optimizeAdminReplies({
                ad: champion.ad,
                productTruth,
                voiceRegister,
                attackComments: indexed.map(({ c, idx }) => ({
                  index: idx,
                  tone: c.tone,
                  comment: c.comment,
                  oldReply: c.suggestedReply,
                })),
                baselineTrustPct: socialContagion.baselineTrustPct,
                afterReplyTrustPct: socialContagion.afterReplyTrustPct,
              }).catch(() => null);

              if (opt) {
                totalTokens += opt.tokens;
                totalCostUsd += opt.costUsd;

                const upgradedThread = indexed.map(({ c, idx }) => ({
                  name: c.name,
                  city: c.city,
                  comment: c.comment,
                  reply: opt.replies.get(idx) ?? c.suggestedReply,
                }));

                const recheck = await scoreCommentRepliesOnly(champion.ad, upgradedThread, contagionVoters).catch(
                  () => null
                );
                if (recheck) {
                  totalTokens += recheck.inputTokens;
                  totalCostUsd += (recheck.inputTokens * 0.02) / 1_000_000;
                  // Verified hill-climbing: ONLY accept upgraded replies if they beat original replies!
                  if (recheck.trustPct > socialContagion.afterReplyTrustPct + 1.5) {
                    simulatedComments = simulatedComments.map((c, idx) => ({
                      ...c,
                      suggestedReply: opt.replies.get(idx) ?? c.suggestedReply,
                    }));
                    socialContagion = {
                      ...socialContagion,
                      afterReplyTrustPct: recheck.trustPct,
                      afterReplyClickPct: recheck.clickPct,
                      trustRecoveryPct: Number((recheck.trustPct - socialContagion.underAttackTrustPct).toFixed(1)),
                      clickRecoveryPct: Number((recheck.clickPct - socialContagion.underAttackClickPct).toFixed(1)),
                      repliesOptimized: true,
                    };
                    send({ type: "comments_ready", comments: simulatedComments });
                  }
                }

                // If trust STILL cannot reach 65% of baseline, surface the missing product-proof warning!
                if (
                  socialContagion.afterReplyTrustPct < socialContagion.baselineTrustPct * 0.65 &&
                  opt.missingTruthGap
                ) {
                  socialContagion = {
                    ...socialContagion,
                    transparencyGapWarning: opt.missingTruthGap,
                  };
                }
              }
            }

            send({ type: "social_contagion", result: socialContagion });
          }
        }

        const splitAdvice = computeSplitCampaignAdvice(allVariants, champion);

        const run: EvolutionRun = {
          id: runId,
          createdAt: new Date().toISOString(),
          title: ad.headline.slice(0, 80),
          productTruth,
          voiceRegister,
          reasoningMode,
          filters: body.filters ?? {},
          trainCount: train.length,
          holdoutCount: holdout.length,
          generationsRequested: generations,
          original: origEval,
          champion,
          variants: allVariants,
          diagnoses,
          funnelCandidates,
          championHistory,
          headToHead: headToHeadResults,
          splitAdvice,
          holdout: holdoutResult,
          feedBattle: feedBattleResult,
          simulatedComments,
          socialContagion,
          counterfactualXray,
          totalTokens,
          totalCostUsd: Number(totalCostUsd.toFixed(5)),
          totalDurationMs: Date.now() - startedAt,
        };

        saveRun(run);
        send({ type: "phase", phase: "done", generation: generations, message: "تکامل تبلیغ، آزمون فید و تایید آماری تکمیل شد." });
        send({ type: "complete", run });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "خطای غیرمنتظره در اجرای بهینه‌سازی";
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
