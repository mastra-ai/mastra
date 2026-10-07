---
'@mastra/core': patch
---

Fixed `DurableAgent.recover()` dropping agent-registered tools after a process crash. Recovered runs now rebuild the agent's tools and workspace, so the model receives the same toolset it had before the crash instead of an empty one.
