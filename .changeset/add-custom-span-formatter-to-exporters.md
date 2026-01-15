---
'@mastra/core': patch
'@mastra/observability': patch
---

Added `customSpanFormatter` option to exporters for per-exporter span transformation. This allows different formatting for different observability platforms (e.g., plain text for Braintrust, structured data for Langfuse).

**Configuration example:**

```ts
import { BraintrustExporter } from "@mastra/braintrust";
import { SpanType } from "@mastra/core/observability";
import type { CustomSpanFormatter } from "@mastra/core/observability";

const plainTextFormatter: CustomSpanFormatter = (span) => {
  if (span.type === SpanType.AGENT_RUN && Array.isArray(span.input)) {
    const userMessage = span.input.find((m) => m.role === "user");
    return { ...span, input: userMessage?.content ?? span.input };
  }
  return span;
};

const exporter = new BraintrustExporter({
  customSpanFormatter: plainTextFormatter,
});
```

Also added `chainFormatters` utility to combine multiple formatters:

```ts
import { chainFormatters } from "@mastra/observability";

const exporter = new BraintrustExporter({
  customSpanFormatter: chainFormatters([formatter1, formatter2]),
});
```
