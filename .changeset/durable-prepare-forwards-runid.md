---
'@mastra/core': patch
---

Fix `DurableAgent.prepare()` ignoring `options.runId`. `prepare()` did not forward `runId` to `prepareForDurableExecution()` (unlike `stream()`), so it always registered a freshly minted run id. This made `prepare()` unusable for rehydrating a persisted, suspended run in a fresh process (e.g. after a server restart or registry eviction): a follow-up `resume(runId)` couldn't find the registry entry `prepare()` had built and threw `No registry entry found for run … Cannot resume.`. `prepare()` now forwards the caller-provided `runId`, so re-registering a known run id and resuming a durable snapshot across a restart works.
