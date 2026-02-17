---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed sub-agent memory context pollution that caused 'Exhausted all fallback models' errors when using Observational Memory with sub-agents. The parent agent's memory context is now preserved across sub-agent tool execution.
