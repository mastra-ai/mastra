---
'@mastra/core': patch
---

Fixed abort signal propagation in agent networks. When using `abortSignal` with `agent.network()`, the signal now correctly prevents tool execution when abort fires during routing, and no longer saves partial results to memory when sub-agents, tools, or workflows are aborted.
