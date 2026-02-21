---
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
---

Observational Memory activation now preserves the agent's suggested next response and current task, so agents maintain conversational continuity when the memory window shrinks during activation.
