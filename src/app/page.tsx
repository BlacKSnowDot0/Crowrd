"use client";

import { useCallback, useEffect, useState } from "react";
import { AdBattleArena } from "@/components/AdBattleArena";
import { CrowdExplorer } from "@/components/CrowdExplorer";
import { ActiveTab, Navbar } from "@/components/Navbar";
import { PersonaInterviewDrawer } from "@/components/PersonaInterviewDrawer";
import { PriceElasticityLab } from "@/components/PriceElasticityLab";
import { RunsHistory, RunSummary } from "@/components/RunsHistory";
import { TestAdStudio } from "@/components/TestAdStudio";
import type { AdCopy, EvolutionRun, Persona, PersonJudgment } from "@/lib/types";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("test");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loadedRun, setLoadedRun] = useState<EvolutionRun | null>(null);

  const [interviewTarget, setInterviewTarget] = useState<{
    persona: Persona;
    judgment?: PersonJudgment;
    ad?: AdCopy;
  } | null>(null);

  const fetchCrowd = useCallback(async () => {
    try {
      const resp = await fetch("/api/crowd");
      if (resp.ok) {
        const data = await resp.json();
        setPersonas(data.profiles ?? []);
      }
    } catch {
      // ignore initial error
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const resp = await fetch("/api/runs");
      if (resp.ok) {
        const data = await resp.json();
        setRuns(data.runs ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCrowd();
    fetchRuns();
  }, [fetchCrowd, fetchRuns]);

  const handleOpenRun = async (id: string) => {
    const resp = await fetch(`/api/runs/${id}`);
    if (resp.ok) {
      const data = await resp.json();
      setLoadedRun(data.run);
      setActiveTab("test");
    }
  };

  const handleDeleteRun = async (id: string) => {
    const resp = await fetch(`/api/runs/${id}`, { method: "DELETE" });
    if (resp.ok) {
      if (loadedRun?.id === id) setLoadedRun(null);
      fetchRuns();
    }
  };

  const handleOpenInterview = (personaId: string, judgment?: PersonJudgment, ad?: AdCopy) => {
    const p = personas.find((x) => x.id === personaId);
    if (!p) return;
    setInterviewTarget({ persona: p, judgment, ad });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#09090B]">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        crowdCount={personas.length}
        runsCount={runs.length}
      />

      <main className="flex-1 px-4 sm:px-6 py-7 sm:py-9">
        {activeTab === "test" && (
          <TestAdStudio
            allPersonas={personas}
            loadedRun={loadedRun}
            onClearLoadedRun={() => setLoadedRun(null)}
            onRunSaved={fetchRuns}
            onOpenInterview={handleOpenInterview}
          />
        )}

        {activeTab === "battle" && <AdBattleArena allPersonas={personas} />}

        {activeTab === "price" && <PriceElasticityLab allPersonas={personas} />}

        {activeTab === "crowd" && (
          <CrowdExplorer
            personas={personas}
            onCrowdUpdated={fetchCrowd}
            onInterviewPersona={(pid) => handleOpenInterview(pid)}
          />
        )}

        {activeTab === "runs" && (
          <RunsHistory
            runs={runs}
            onOpenRun={handleOpenRun}
            onDeleteRun={handleDeleteRun}
          />
        )}
      </main>

      <PersonaInterviewDrawer
        persona={interviewTarget?.persona ?? null}
        judgment={interviewTarget?.judgment}
        ad={interviewTarget?.ad}
        onClose={() => setInterviewTarget(null)}
      />
    </div>
  );
}
