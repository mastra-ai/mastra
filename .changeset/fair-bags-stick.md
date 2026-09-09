---
'@mastra/core': minor
---

Added typed `input` and `output` payloads for the spans Mastra records itself: `AGENT_RUN`, `MODEL_GENERATION`, `MODEL_STEP` and `MODEL_INFERENCE`. Every other span type keeps `any`. Stored spans narrow the same way with `isSpanRecordOfType`, which types `attributes`, `input` and `output` without a cast:

```ts
import { SpanType, isSpanRecordOfType } from '@mastra/core/observability';

if (isSpanRecordOfType(span, SpanType.MODEL_GENERATION)) {
  span.attributes?.usage; // UsageStats | undefined
  span.input?.messages; // MessageListInput
}
```

A resumed agent run now always records its resume data as an object on the span input, wrapping a primitive or array under `resumeData` the way it already did when the suspended tool was known.

For rendering, `describeSpanInput`, `describeSpanOutput` and `describeSpanError` return the payload tagged by what it holds (`messages`, `agent-run-resume`, `interrupted`, `model-generation-result`, `json`, ...), so a UI can switch on `type` instead of checking shapes. The tag is derived at read time and never stored.
