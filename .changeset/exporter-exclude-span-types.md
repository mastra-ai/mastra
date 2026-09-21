---
'@mastra/observability': minor
---

Added an `excludeSpanTypes` option to every exporter config. Spans of the listed types are dropped by that exporter only, so other exporters on the same observability instance still receive them.

Use this to keep high-volume span types such as `MODEL_CHUNK` out of a platform that bills per span, while Mastra Studio or another exporter keeps the full trace:

```ts
import { SpanType } from '@mastra/core/observability';
import { LangfuseExporter } from '@mastra/langfuse';

new LangfuseExporter({
  excludeSpanTypes: [SpanType.MODEL_CHUNK],
});
```

The observability-level `excludeSpanTypes` option still applies to all exporters at once. Exporter-level exclusion runs before the exporter's `customSpanFormatter`.

Related: https://github.com/mastra-ai/mastra/issues/24432
