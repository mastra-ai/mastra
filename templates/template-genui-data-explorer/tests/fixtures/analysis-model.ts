import type { MastraModelConfig, LanguageModel } from "@mastra/core/llm";

type Model = Exclude<Extract<MastraModelConfig, { specificationVersion: "v2" }>, LanguageModel>;
type Options = Parameters<Model["doGenerate"]>[0];

/** Exercises Mastra's real model loop and tools without a provider key or network. */
export function analysisModel(
  plans: readonly unknown[],
  options: { repeat?: boolean; fail?: boolean; stall?: boolean; text?: string } = {},
) {
  const calls: Options[] = [];
  const generate: Model["doGenerate"] = async (call) => {
    calls.push(call);
    if (options.fail) throw new Error("Synthetic provider outage, credential=not-a-real-secret");
    if (options.stall) return new Promise(() => {});
    const plan =
      plans[options.repeat ? 0 : call.prompt.filter((message) => message.role === "tool").length];
    return {
      content:
        plan === undefined
          ? [
              {
                type: "text",
                text: options.text ?? "Untrusted model claims growth was 999999 percent.",
              },
            ]
          : [
              {
                type: "tool-call",
                toolCallId: `call-${calls.length}`,
                toolName: "analyze",
                input: JSON.stringify(plan),
              },
            ],
      finishReason: plan === undefined ? "stop" : "tool-calls",
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      warnings: [],
    };
  };
  const model: Model = {
    specificationVersion: "v2",
    provider: "deterministic",
    modelId: "analytical-proof",
    supportedUrls: {},
    doGenerate: generate,
    doStream: async (call) => {
      const result = await generate(call);
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            for (const content of result.content) {
              if (content.type === "text") {
                controller.enqueue({ type: "text-start", id: "answer" });
                controller.enqueue({ type: "text-delta", id: "answer", delta: content.text });
                controller.enqueue({ type: "text-end", id: "answer" });
              } else if (content.type === "tool-call") controller.enqueue(content);
            }
            controller.enqueue({
              type: "finish",
              finishReason: result.finishReason,
              usage: result.usage,
            });
            controller.close();
          },
        }),
        warnings: [],
      };
    },
  };
  return { model, calls };
}
