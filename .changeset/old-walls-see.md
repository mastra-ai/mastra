---
'@mastra/core': minor
---

Added native Agent execution on the durable or evented engine while preserving model-output APIs. Configure an agent with `durable: { executionEngine: "durable" }` or set `Mastra.durable.executionEngine` for registered agents. Existing wrapper factories keep their stream result contracts.
