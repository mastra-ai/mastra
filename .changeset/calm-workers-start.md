---
'@mastra/core': patch
---

Fixed Mastra failing to start on Cloudflare Workers with a compatibility date before 2025-05-05, including the Cloudflare deployer's default `2025-04-01`. Startup threw `ReferenceError: FinalizationRegistry is not defined` because those runtimes do not provide `FinalizationRegistry`. Agents now start there, and stopping a stream without a thread through `abortRunStream(runId)` still works.

In those runtimes, a stream without a thread that is started but never read stays tracked until it finishes or is aborted, instead of being cleaned up when it is garbage collected.
