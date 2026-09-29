---
'@mastra/core': patch
---

Fixed durable agent resumes (including `InngestAgent`) running another agent's tool when two agents register tools with the same id. On a cold worker, tool calls now resolve against the run's own agent before falling back to Mastra-wide tools.
