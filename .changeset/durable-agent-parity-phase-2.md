---
'@mastra/core': patch
---

`DurableAgent` now matches `Agent` for several per-step behaviors that were silently degraded on the durable path:

- Tools suspended for human-in-the-loop now receive the same auto-resume system-message rewrite when `autoResumeSuspendedTools` is enabled.
- Agents wired to a `BackgroundTaskManager` get the background-task guidance prompt injected before each LLM call.
- Model `supportedUrls` (including async resolvers) is honored consistently for both regular and durable runs.
- HTTP headers attached to LLM calls (memory routing, model-config, call-time `modelSettings.headers`) merge in a single documented order and are case-normalized so call-time values reliably override.
- `prepareStep` and input-processor overrides — including `model`, `tools`, `activeTools`, `providerOptions`, `modelSettings`, `structuredOutput`, and `workspace` — apply identically on both paths.
