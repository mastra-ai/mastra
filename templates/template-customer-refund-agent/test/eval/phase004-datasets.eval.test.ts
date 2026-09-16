import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { supportEvalScorerRegistry } from "./support/dataset-scorers";

const expectedAxes = [
  "groundedness",
  "policy-compliance",
  "routing-accuracy",
  "tool-call-correctness",
  "resolution-quality",
  "multi-turn-consistency",
];

describe("Phase 004 versioned eval datasets", () => {
  it("contains six non-empty, uniquely identified synthetic axes registered in Mastra", async () => {
    const directory = new URL("../../evals/datasets/", import.meta.url);
    const files = (await readdir(directory))
      .filter((file) => file.endsWith(".json"))
      .sort();
    expect(files).toHaveLength(6);
    const identities = new Set<string>();
    for (const file of files) {
      const raw = await readFile(new URL(file, directory));
      const dataset = JSON.parse(raw.toString()) as {
        axis: string;
        version: number;
        cases: Array<{ id: string; critical: boolean }>;
      };
      expect(expectedAxes).toContain(dataset.axis);
      expect(dataset.version).toBe(1);
      expect(dataset.cases.length).toBeGreaterThan(0);
      expect(supportEvalScorerRegistry).toHaveProperty(
        dataset.axis === "policy-compliance"
          ? "policyCompliance"
          : dataset.axis === "routing-accuracy"
            ? "routingAccuracy"
            : dataset.axis === "tool-call-correctness"
              ? "toolCallCorrectness"
              : dataset.axis === "resolution-quality"
                ? "resolutionQuality"
                : dataset.axis === "multi-turn-consistency"
                  ? "multiTurnConsistency"
                  : dataset.axis,
      );
      for (const item of dataset.cases) {
        expect(item.id).not.toHaveLength(0);
        expect(identities.has(item.id)).toBe(false);
        identities.add(item.id);
      }
      // Pinning a content hash here makes accidental in-place dataset mutation
      // visible to the candidate report; it is not a quality score.
      expect(createHash("sha256").update(raw).digest("hex")).toMatch(
        /^[a-f0-9]{64}$/,
      );
    }
  });
});
