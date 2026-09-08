---
'@mastra/server': patch
---

Initialize agent-controller SSE connections with the current display state so clients attaching during a tool execution can render the pending message immediately, and clients attaching after completion receive the idle state.
