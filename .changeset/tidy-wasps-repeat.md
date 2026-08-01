---
'@mastra/core': patch
---

Fixed `collectToolMocks` emitting `output: undefined` for tool-call trajectory steps without a recorded `toolResult` (e.g. failed or suspended calls). `JSON.stringify` drops `undefined` keys, so saving a dataset item from such a trace failed server-side validation with `400 Invalid request body: toolMocks.N.output — expected nonoptional, received undefined`. Missing results are now persisted as `null`.
