---
'@mastra/core': minor
---

Added typed `input` and `output` payloads for spans.

Every span carried `input?: any` and `output?: any`, so consumers had to guess what a span recorded. Two new maps, `SpanInputMap` and `SpanOutputMap`, now sit beside `SpanTypeMap` and describe the payload each span type records. `AGENT_RUN` and `MODEL_GENERATION` get concrete shapes (`AgentRunInput`, `AgentRunOutput`, `ModelGenerationInput`, `ModelGenerationOutput`, `InterruptedSpanOutput`); span types that carry caller-defined data stay `unknown`, and `GENERIC` stays `any` so custom spans and span formatters keep compiling.

Stored spans can be narrowed the same way. `SpanRecord` accepts a span type, and `isSpanRecordOfType` narrows a record to it, typing `attributes`, `input` and `output`:

```ts
import { SpanType, isSpanRecordOfType } from '@mastra/core/observability';

if (isSpanRecordOfType(span, SpanType.MODEL_GENERATION)) {
  span.attributes?.usage; // UsageStats | undefined, no cast
  span.input?.messages; // MessageListInput
}
```

Nothing changes on the wire or in storage: the runtime schema stays permissive, so existing traces keep loading. If you create `AGENT_RUN` or `MODEL_GENERATION` spans yourself, their `input` and `output` must now match the new types at compile time; every other span type is unaffected.
