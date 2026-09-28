---
'@mastra/core': patch
---

Fixed non-forked AgentController subagents failing with `[Processor:browser-context] computeStateSignal requires Mastra memory` when the workspace has a browser. Agents without memory still receive browser context in their prompt but no longer compute the browser state signal, which requires a memory thread.
