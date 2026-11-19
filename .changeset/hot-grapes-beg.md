---
'@mastra/platform': minor
'@mastra/server': patch
'@mastra/core': patch
---

PlatformMemory now reports hosted Observational Memory settings and reads the current observation record and past generations through its authenticated client, so Studio's memory status and observations views work for agents using PlatformMemory. Added `getObservationRecords(threadId, { historyLimit })` and `getInstanceConfig()` to `PlatformMemoryClient`. Date range and offset filters on observation history, and reads without a thread id, are not supported by the hosted API yet and return a 400 error.
