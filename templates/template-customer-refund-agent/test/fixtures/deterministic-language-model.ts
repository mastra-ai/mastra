import type { LanguageModelV2 } from "@ai-sdk/provider";

export type DeterministicRefundModel = LanguageModelV2;

export function deterministicJsonModel(
  value: Record<string, unknown>,
): LanguageModelV2 {
  return {
    specificationVersion: "v2",
    provider: "phase003-test",
    modelId: "deterministic-json",
    supportedUrls: {},
    async doGenerate() {
      return {
        content: [{ type: "text" as const, text: JSON.stringify(value) }],
        finishReason: "stop" as const,
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error("Deterministic test model only supports generate.");
    },
  };
}

export function deterministicRefundModel(
  input: Record<string, unknown>,
): LanguageModelV2 {
  let called = false;
  return {
    specificationVersion: "v2",
    provider: "phase003-test",
    modelId: "deterministic-refund",
    supportedUrls: {},
    async doGenerate(options) {
      if (!called && options.tools?.some((tool) => tool.type === "function")) {
        called = true;
        return {
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "native-tool-call",
              toolName: "issue_refund",
              input: JSON.stringify(input),
            },
          ],
          finishReason: "tool-calls" as const,
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
        };
      }
      return {
        content: [{ type: "text" as const, text: "done" }],
        finishReason: "stop" as const,
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error("Deterministic test model only supports generate.");
    },
  };
}
