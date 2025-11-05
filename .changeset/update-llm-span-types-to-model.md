---
"@mastra/core": minor
"@mastra/otel-exporter": minor
"@mastra/langsmith": minor
"@mastra/langfuse": minor
"@mastra/braintrust": minor
---

Rename LLM span types and attributes to use Model prefix

BREAKING CHANGE: This release renames tracing span types and attribute interfaces to use the "Model" prefix instead of "LLM":

- `AISpanType.LLM_GENERATION` → `AISpanType.MODEL_GENERATION`
- `AISpanType.LLM_STEP` → `AISpanType.MODEL_STEP`
- `AISpanType.LLM_CHUNK` → `AISpanType.MODEL_CHUNK`
- `LLMGenerationAttributes` → `ModelGenerationAttributes`
- `LLMStepAttributes` → `ModelStepAttributes`
- `LLMChunkAttributes` → `ModelChunkAttributes`
- `InternalSpans.LLM` → `InternalSpans.MODEL`

This change better reflects that these span types apply to all AI models, not just Large Language Models.

Migration guide:
- Update all imports: `import { ModelGenerationAttributes } from '@mastra/core/ai-tracing'`
- Update span type references: `AISpanType.MODEL_GENERATION`
- Update InternalSpans usage: `InternalSpans.MODEL`
