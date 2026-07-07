---
'@mastra/core': patch
---

Durable agents now stop cleanly when cancelled via an abort signal, reporting the correct `abort` finish reason instead of crashing. The `sendMessage` and `sendSignal` wake flows also work reliably for durable agents, so thread subscribers receive streamed chunks as expected.
