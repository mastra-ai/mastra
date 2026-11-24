import { it } from "vitest";
import { expectEvals } from "@mastra/evals/vitest";
import { createScorer } from "@mastra/core/evals";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

it("official_eval_rejects_a_known_numeric_regression", async () => {
  const schema = z.object({ value: z.number() });
  const step = createStep({
    id: "regressed-calculation",
    inputSchema: schema,
    outputSchema: schema,
    execute: async () => ({ value: 999999 }),
  });
  const target = createWorkflow({
    id: "known-regression",
    inputSchema: schema,
    outputSchema: schema,
  })
    .then(step)
    .commit();
  const gate = createScorer({
    id: "exact-money",
    description: "Money must equal independent expected cents.",
  }).generateScore(({ run }) => (schema.parse(run.output).value === 12000 ? 1 : 0));
  await expectEvals({ target, gates: [gate], data: [{ input: { value: 12000 } }] }).toPass();
});
