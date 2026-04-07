---
'@mastra/core': minor
'@mastra/observability': minor
---

Added `excludeSpanTypes` and `spanFilter` options to `ObservabilityInstanceConfig` for selectively filtering spans before export. Use `excludeSpanTypes` to drop entire categories of spans by type (e.g., `MODEL_CHUNK`, `MODEL_STEP`) or `spanFilter` for fine-grained predicate-based filtering by attributes, metadata, entity, or any combination. Both options help reduce noise and costs in observability platforms that charge per-span.

**`excludeSpanTypes` example:**

```ts
excludeSpanTypes: [SpanType.MODEL_CHUNK, SpanType.MODEL_STEP, SpanType.WORKFLOW_SLEEP];
```

**`spanFilter` example:**

```ts
spanFilter: span => {
  if (span.type === SpanType.MODEL_CHUNK) return false;
  if (span.type === SpanType.TOOL_CALL && span.attributes?.success) return false;
  return true;
};
```

Resolves https://github.com/mastra-ai/mastra/issues/12710
