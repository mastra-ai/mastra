---
'@mastra/core': minor
'@mastra/platform': patch
'@mastra/server': patch
---

Added optional `getObservationalMemoryConfig()` and `getObservationalMemoryRecords()` methods to `MastraMemory`. Memory implementations that run Observational Memory outside the agent (such as hosted memory) can override them so the memory status, config and observational memory routes report their settings and records. Both return `undefined` by default, so existing memory implementations are unaffected.
