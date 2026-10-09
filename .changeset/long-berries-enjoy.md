---
'@mastra/core': patch
---

Durable and evented agents now include `runId` in `onStepFinish` and `onFinish`, matching the regular Agent. Use `runId` to tell which run an event came from when callbacks are shared across runs.

`onFinish` also now includes `model`, `messages`, `object`, `error` and `usedFallbackValue`. You can read the structured output and response messages directly in the callback. Fixes #26524.
