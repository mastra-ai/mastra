---
"@mastra/core": patch
---

Fixed sub-agents in `agent.network()` not receiving conversation history.

Sub-agents now have access to previous user messages from the conversation, enabling them to understand context from earlier exchanges. This resolves the issue where sub-agents would respond without knowledge of prior conversation turns.

Fixes #11468
