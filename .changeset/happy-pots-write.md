---
'@mastra/core': patch
---

Fixed subagents receiving parent's tool call/result parts in their context messages. On subsequent queries in a conversation, these references to tools the subagent doesn't have caused models (especially via custom gateways) to return blank or incorrect results. Parent delegation tool artifacts are now stripped from context before forwarding to sub-agents.
