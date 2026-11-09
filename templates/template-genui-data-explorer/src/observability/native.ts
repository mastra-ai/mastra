import { Observability, MastraStorageExporter } from "@mastra/observability";
import type { SpanOutputProcessor } from "@mastra/core/observability";
import { redact } from "./telemetry.ts";

/** Native traces retain timings, hierarchy and correlation, never conversational/result payloads. */
export const diagnosticSpans: SpanOutputProcessor = {
  name: "local-diagnostic-metadata",
  process(span) {
    if (!span) return;
    const metadata: Record<string, unknown> = {};
    const allowed = new Set([
      "requestId",
      "workspaceId",
      "threadId",
      "analysisTraceId",
      "datasetVersion",
      "model",
      "modelId",
      "provider",
      "inputTokens",
      "outputTokens",
      "totalTokens",
    ]);
    for (const fields of [span.metadata, span.attributes]) {
      if (!fields) continue;
      for (const [key, value] of Object.entries(fields))
        if (allowed.has(key) && (typeof value === "string" || typeof value === "number"))
          metadata[key] = typeof value === "string" ? redact(value) : value;
    }
    span.name = redact(span.name);
    span.metadata = metadata;
    delete span.input;
    delete span.output;
    delete span.requestContext;
    delete span.attributes;
    if (span.errorInfo)
      span.errorInfo = {
        message: "Execution failed; inspect the correlated domain outcome.",
        ...(span.errorInfo.category ? { category: redact(span.errorInfo.category) } : {}),
      };
    return span;
  },
  shutdown: async () => {},
};
export function localObservability() {
  return new Observability({
    configs: {
      local: {
        serviceName: "genui-data-explorer",
        exporters: [new MastraStorageExporter({ maxBatchWaitMs: 100, maxRetries: 0 })],
        spanOutputProcessors: [diagnosticSpans],
        requestContextKeys: [
          "requestId",
          "workspaceId",
          "threadId",
          "analysisTraceId",
          "datasetVersion",
        ],
        logging: { enabled: false },
      },
    },
  });
}
