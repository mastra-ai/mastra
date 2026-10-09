---
'@mastra/core': patch
---

Fixed durable and evented agents (including `createInngestAgent`) so `onStepFinish` and `onFinish` callbacks include `runId`, matching the regular Agent. `onFinish` now also includes `model`, `messages`, `object`, `error` and `usedFallbackValue`, so callbacks shared across runs can tell which run an event came from and read its structured output. Fixes #26524.
