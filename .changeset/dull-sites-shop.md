---
'@mastra/core': patch
---

Fixed resumed agent observability spans so `agent.resumeStream()` and `agent.resumeGenerate()` use the resume payload as the `AGENT_RUN` span input instead of an empty array.

Resumed spans now also link back to the suspended trace when persisted tracing context is available, so human-in-the-loop approval flows show the decision payload and remain connected in tracing backends. Fixes #17075.
