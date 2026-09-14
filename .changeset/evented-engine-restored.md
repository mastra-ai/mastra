---
'@mastra/core': patch
---

EventedAgent runs on the built-in evented workflow engine again. It previously fell back to the default in-process engine because the evented path crashed on resume and recovery. Those bugs are fixed, and the engine is now covered by the durable-agent conformance suite — including crash recovery: a fresh process over the same storage can resume in-flight runs via `recover(runId)` / `recoverActiveRuns()`.
