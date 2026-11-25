import fs from "node:fs";
import path from "node:path";
import type { AudienceFilters, EvolutionRun, Persona } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const CROWD_FILE = path.join(DATA_DIR, "iran_crowd.json");
const RUNS_DIR = path.join(DATA_DIR, "runs");

let cachedCrowd: { mtimeMs: number; profiles: Persona[] } | null = null;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });
}

export function loadCrowd(): Persona[] {
  ensureDirs();
  if (!fs.existsSync(CROWD_FILE)) return [];
  const stat = fs.statSync(CROWD_FILE);
  if (cachedCrowd && cachedCrowd.mtimeMs === stat.mtimeMs) {
    return cachedCrowd.profiles;
  }
  const raw = JSON.parse(fs.readFileSync(CROWD_FILE, "utf-8"));
  const profiles: Persona[] = raw.profiles ?? [];
  cachedCrowd = { mtimeMs: stat.mtimeMs, profiles };
  return profiles;
}

export function appendPersonasToCrowd(newProfiles: Persona[]): Persona[] {
  ensureDirs();
  const existing = loadCrowd();
  const combined = [...existing, ...newProfiles];
  fs.writeFileSync(
    CROWD_FILE,
    JSON.stringify(
      {
        version: "1.0",
        generated_at: new Date().toISOString(),
        count: combined.length,
        profiles: combined,
      },
      null,
      2
    ),
    "utf-8"
  );
  cachedCrowd = null;
  return combined;
}

export function filterCrowd(profiles: Persona[], filters?: AudienceFilters, query?: string): Persona[] {
  if (!filters && !query) return profiles;
  const q = query?.trim().toLowerCase();
  return profiles.filter((p) => {
    if (filters?.cityTiers && filters.cityTiers.length > 0 && !filters.cityTiers.includes(p.city_tier)) {
      return false;
    }
    if (filters?.incomeTiers && filters.incomeTiers.length > 0 && !filters.incomeTiers.includes(p.income_tier)) {
      return false;
    }
    if (filters?.gender && filters.gender !== "all" && p.gender !== filters.gender) {
      return false;
    }
    if (typeof filters?.minAge === "number" && p.age < filters.minAge) {
      return false;
    }
    if (typeof filters?.maxAge === "number" && p.age > filters.maxAge) {
      return false;
    }
    if (filters?.sectors && filters.sectors.length > 0 && !filters.sectors.includes(p.sector)) {
      return false;
    }
    if (filters?.archetypes && filters.archetypes.length > 0 && !filters.archetypes.includes(p.ad_archetype)) {
      return false;
    }
    if (filters?.customTag && filters.customTag !== "all") {
      if (p.custom_tag !== filters.customTag) return false;
    }
    if (q) {
      const hay = `${p.name} ${p.city} ${p.neighborhood} ${p.province} ${p.job} ${p.sector} ${p.ad_archetype} ${p.life_story} ${p.custom_tag ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Deterministic seeded Fisher-Yates shuffle so train/holdout splits are stratified and reproducible */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function splitTrainAndHoldout(
  matched: Persona[],
  requestedTrain: number,
  requestedHoldout: number,
  seed = Date.now()
): { train: Persona[]; holdout: Persona[] } {
  // Interleave by city_tier + archetype so both train and holdout are demographically balanced
  const shuffled = seededShuffle(matched, seed);
  if (shuffled.length <= 12) {
    const splitAt = Math.max(4, Math.floor(shuffled.length * 0.75));
    return { train: shuffled.slice(0, splitAt), holdout: shuffled.slice(splitAt) };
  }
  const totalReq = requestedTrain + requestedHoldout;
  if (shuffled.length >= totalReq) {
    return {
      train: shuffled.slice(0, requestedTrain),
      holdout: shuffled.slice(requestedTrain, requestedTrain + requestedHoldout),
    };
  }
  // Proportional split if matched pool is smaller than requested
  const ratio = requestedTrain / Math.max(1, totalReq);
  const trainCount = Math.max(6, Math.min(shuffled.length - 4, Math.round(shuffled.length * ratio)));
  return {
    train: shuffled.slice(0, trainCount),
    holdout: shuffled.slice(trainCount),
  };
}

export function getPersonaById(id: string): Persona | undefined {
  return loadCrowd().find((p) => p.id === id);
}

// ---------- Run Persistence ----------

export function saveRun(run: EvolutionRun): void {
  ensureDirs();
  const filePath = path.join(RUNS_DIR, `${run.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(run, null, 2), "utf-8");
}

export function listRuns(): Array<{
  id: string;
  createdAt: string;
  title: string;
  trainCount: number;
  holdoutCount: number;
  originalFitness: number;
  championFitness: number;
  holdoutOriginalFitness?: number;
  holdoutChampionFitness?: number;
  generationsCount: number;
  totalCostUsd: number;
}> {
  ensureDirs();
  const files = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith(".json"));
  const summaries = [];
  for (const f of files) {
    try {
      const run: EvolutionRun = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), "utf-8"));
      summaries.push({
        id: run.id,
        createdAt: run.createdAt,
        title: run.title,
        trainCount: run.trainCount,
        holdoutCount: run.holdoutCount,
        originalFitness: run.original.fitness,
        championFitness: run.champion.fitness,
        holdoutOriginalFitness: run.holdout?.original.fitness,
        holdoutChampionFitness: run.holdout?.champion.fitness,
        generationsCount: Math.max(0, run.championHistory.length - 1),
        totalCostUsd: run.totalCostUsd,
      });
    } catch {
      // skip corrupt file
    }
  }
  return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getRunById(id: string): EvolutionRun | null {
  ensureDirs();
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(RUNS_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function deleteRunById(id: string): boolean {
  ensureDirs();
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(RUNS_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
