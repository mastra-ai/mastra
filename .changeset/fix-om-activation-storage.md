---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
---

Storage adapters now return `suggestedContinuation` and `currentTask` fields on Observational Memory activation, enabling agents to maintain conversational context across activation boundaries.
