---
'@mastra/core': patch
---

Fix durable agents orphaning per-step output processor spans. In `createDurableLLMExecutionStep`, the `runProcessOutputStep(...)` call omitted `tracingContext` (unlike the sibling `runProcessInputStep`/`runProcessLLMRequest` calls), so `output step processor` `processor_run` spans were created without a parent and appeared as their own root traces — one per LLM step — instead of nesting under `MODEL_STEP` → `AGENT_RUN`. Passing `tracingContext: modelSpanTracker?.getTracingContext() ?? tracingContext` restores parity with the non-durable path. Fixes #19312.
