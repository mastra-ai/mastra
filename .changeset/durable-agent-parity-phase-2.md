---
'@mastra/core': patch
---

Bring `DurableAgent` to behavioral parity with `Agent` on per-step LLM execution. Tools wired to `autoResumeSuspendedTools` now have the resume system-message rewritten on durable runs the same way regular runs do. Agents with a `BackgroundTaskManager` now have the background-task guidance prompt injected before the LLM call on the durable path. Per-step `model.supportedUrls` (including async resolvers), `downloadRetries` and `downloadConcurrency` flow through a single shared resolver so durable runs honor every model's URL policy. `LLM-call headers` (memory `x-thread-id` / `x-resource-id`, model-config headers, call-time `modelSettings.headers`) merge in the same order on both paths. `prepareStep` / input-processor results are applied identically on both paths — `modelSettings` is replaced rather than shallow-merged, matching the regular agent.
