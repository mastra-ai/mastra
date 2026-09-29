---
'@mastra/core': patch
---

Fixed AgentController not showing live progress for subagents delegated through `Agent.agents`. These subagents now appear in `displayState.activeSubagents` while they run, with their tool calls and text streaming in, instead of only showing up once they finish. Fixes #25019.
