---
'@mastra/core': patch
---

Fixed durable agents dropping `scoringData` from `generate()` and `stream()` results when `returnScorerData: true` is set. The flag was serialized into the durable workflow input but never forwarded to the client-side output, so `runEvals` and `startExperiment` scorers silently evaluated `undefined` output. Durable agents now return `scoringData` across generate, stream, resume, and recovery paths, matching non-durable agents. Also fixed tool-calling durable runs replacing the run's message list mid-run, which left resumed runs reading stale messages. Fixes #22743
