---
'@mastra/core': patch
---

Fixed channel agents calling a missing `add_reaction` tool. The channel instructions now mention reacting only when the agent has the `add_reaction` tool, for example via `channels.getTools()`.
