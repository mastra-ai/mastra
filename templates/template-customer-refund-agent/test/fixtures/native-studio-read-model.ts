import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";

const firstAnswer =
  "ORD-1001 is fulfilled. This was a read-only investigation.";
const followUpAnswer = "Follow-up completed with the same read-only case.";

function stream(parts: LanguageModelV2StreamPart[]) {
  return new ReadableStream<LanguageModelV2StreamPart>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

function completedText(id: string, text: string): LanguageModelV2StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id },
    { type: "text-delta", id, delta: text },
    { type: "text-end", id },
    {
      type: "finish",
      finishReason: "stop",
      usage: { inputTokens: 1, outputTokens: 1 },
    },
  ];
}

function successfulOrderResult(prompt: LanguageModelV2Prompt) {
  return prompt.some(
    (message) =>
      message.role === "tool" &&
      message.content.some((part) => {
        if (part.type !== "tool-result" || part.toolName !== "lookup_order")
          return false;
        const output = part.output;
        if (output.type !== "json") return false;
        const value = output.value;
        return (
          typeof value === "object" &&
          value !== null &&
          "found" in value &&
          value.found === true &&
          "order" in value &&
          typeof value.order === "object" &&
          value.order !== null &&
          "orderId" in value.order &&
          value.order.orderId === "ORD-1001" &&
          "status" in value.order &&
          value.order.status === "fulfilled"
        );
      }),
  );
}

/**
 * The clean-clone smoke copies this test-only model into its disposable clone
 * and injects it there. It never changes production model selection.
 */
export function nativeStudioReadModel(): LanguageModelV2 {
  let calls = 0;
  return {
    specificationVersion: "v2",
    provider: "phase007-test",
    modelId: "native-studio-read",
    supportedUrls: {},
    async doGenerate() {
      throw new Error("The native Studio fixture only supports streaming.");
    },
    async doStream(options: LanguageModelV2CallOptions) {
      calls += 1;
      if (calls === 1)
        return {
          stream: stream([
            { type: "stream-start", warnings: [] },
            {
              type: "tool-call",
              toolCallId: "studio-order-read",
              toolName: "lookup_order",
              input: JSON.stringify({ orderId: "ORD-1001" }),
            },
            {
              type: "finish",
              finishReason: "tool-calls",
              usage: { inputTokens: 1, outputTokens: 1 },
            },
          ]),
        };
      if (calls === 2) {
        if (!successfulOrderResult(options.prompt))
          throw new Error(
            "Studio smoke refuses to answer until lookup_order returns fulfilled ORD-1001.",
          );
        return { stream: stream(completedText("studio-result", firstAnswer)) };
      }
      return {
        stream: stream(completedText("studio-follow-up", followUpAnswer)),
      };
    },
  };
}
