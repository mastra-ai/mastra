---
'@mastra/editor': patch
---

Resolving stored agent versions no longer mutates the shared singleton agent instance. Instruction and tool overrides are now applied to an isolated clone, making concurrent version resolution safe and preventing overrides from leaking onto the global agent.
