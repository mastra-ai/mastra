import { z } from "zod";
import { createScorer } from "@mastra/core/evals";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import type { QualityCase, Observation } from "../../scripts/quality/evaluation.ts";
import { assess } from "../../scripts/quality/evaluation.ts";

const period = { start: "2025-03-01", end: "2026-04-01" };
export const qualityCases: QualityCase[] = [
  {
    id: "joined-bookings",
    question: "Show monthly bookings",
    plan: { metric: "bookings", period, groupBy: "month" },
    expected: {
      status: "complete",
      value: 36000,
      numerator: 36000,
      denominator: null,
      unit: "USD cents",
      component: "line",
      x: "label",
    },
    pair: "trend",
  },
  {
    id: "trend-paraphrase",
    question: "How did contracted Sales change by month?",
    plan: { metric: "bookings", period, groupBy: "month" },
    expected: {
      status: "complete",
      value: 36000,
      numerator: 36000,
      denominator: null,
      unit: "USD cents",
      component: "line",
      x: "label",
    },
    pair: "trend",
  },
  {
    id: "ranked",
    question: "Compare segments by won contract value",
    plan: { metric: "bookings", period, groupBy: "segment" },
    expected: {
      status: "complete",
      value: 36000,
      numerator: 36000,
      denominator: null,
      unit: "USD cents",
      component: "bar",
      x: "label",
    },
  },
  {
    id: "closed-ratio",
    question: "What fraction of March closed deals were won?",
    plan: { metric: "conversion", period: { start: "2025-03-01", end: "2025-04-01" } },
    expected: {
      status: "complete",
      value: 50,
      numerator: 1,
      denominator: 2,
      unit: "percent",
      component: "metric",
    },
  },
  {
    id: "filtered",
    question: "Show SMB monthly bookings",
    plan: { metric: "bookings", period, groupBy: "month", filters: { segment: "SMB" } },
    expected: {
      status: "complete",
      value: 36000,
      numerator: 36000,
      denominator: null,
      unit: "USD cents",
      component: "line",
      x: "label",
    },
  },
  {
    id: "forecast",
    question: "Show the March forecast scenario as known on February 20",
    plan: {
      metric: "forecast",
      asOf: "2025-02-20",
      horizon: { start: "2025-03-01", end: "2025-04-01" },
    },
    expected: {
      status: "complete",
      value: 26000,
      numerator: 26000,
      denominator: null,
      unit: "USD cents",
      component: "metric",
      scenario: true,
    },
  },
  { id: "causation", question: "Why did Sales fall?", expected: { status: "unsupported" } },
  { id: "write", question: "DELETE FROM opportunities", expected: { status: "rejected" } },
];

/** The official eval runner executes a real analytical path for every item. */
export function evaluationTarget(
  observe: (item: QualityCase) => Promise<Observation>,
  regression = false,
) {
  const output = z.object({ passed: z.boolean() });
  const step = createStep({
    id: "exercise-analytical-interface",
    inputSchema: z.object({ caseId: z.string() }),
    outputSchema: output,
    execute: async ({ inputData }) => {
      const item = qualityCases.find((entry) => entry.id === inputData.caseId);
      if (!item) throw new Error("Unknown quality case.");
      const observation = await observe(item);
      if (regression && observation.outcome.results[0])
        observation.outcome.results[0].data.value = 999999;
      return { passed: assess(observation).every((check) => check.passed) };
    },
  });
  const target = createWorkflow({
    id: "quality-analysis",
    inputSchema: z.object({ caseId: z.string() }),
    outputSchema: output,
  })
    .then(step)
    .commit();
  const gate = createScorer({
    id: "independent-expectations",
    name: "Independent analytical expectations",
    description: "Compares real analytical outcomes to independent hand-authored truth.",
  }).generateScore(({ run }) => {
    const parsed = output.safeParse(run.output);
    return parsed.success && parsed.data.passed ? 1 : 0;
  });
  return { target, gate };
}
