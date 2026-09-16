import { describe, expect, it, vi } from "vitest";

vi.mock("@mastra/core/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mastra/core/llm")>();
  return {
    ...actual,
    ModelRouterEmbeddingModel: class DeterministicEmbeddingModel {},
  };
});

import { scoreDraftResolutionFields } from "./support/dataset-scorers";

describe("phase-scoped deterministic eval compatibility", () => {
  it("recognizes a grounded structured response without invoking a model", () => {
    expect(
      scoreDraftResolutionFields(
        JSON.stringify({
          draftResponse:
            "We found the duplicate charge and sent it for approval.",
          citedSources: ["Duplicate charge policy"],
          recommendRefund: true,
          requiresEscalation: false,
        }),
      ),
    ).toMatchObject({
      hasDraftResponse: true,
      hasSources: true,
      recommendsRefund: true,
      requiresEscalation: false,
    });
  });
});
