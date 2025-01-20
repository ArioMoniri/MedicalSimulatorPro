import { useQuery, useMutation } from "@tanstack/react-query";
import type { Scenario, UserProgress } from "@db/schema";

export function useSimulator() {
  const { data: scenarios } = useQuery<Scenario[]>({
    queryKey: ["/api/scenarios"],
  });

  const { data: progress } = useQuery<UserProgress[]>({
    queryKey: ["/api/progress"],
  });

  const updateProgress = useMutation({
    mutationFn: async ({ scenarioId, score, feedback }: {
      scenarioId: number;
      score: number;
      feedback: string;
    }) => {
      const res = await fetch(`/api/progress/${scenarioId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, feedback }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
  });

  return {
    scenarios,
    progress,
    updateProgress: updateProgress.mutateAsync,
  };
}
