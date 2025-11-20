---
'@mastra/core': patch
---

fix(agent): persist messages before tool suspension

Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension.

Changes:
- Add assistant messages to messageList immediately after LLM execution, before tool calls
- Flush messages synchronously before suspension at both approval and generic suspension points
- Create thread immediately before flushing if it doesn't exist
- Pass saveQueueManager, memoryConfig, and memory context through workflow for immediate persistence

Fixes #9745, #9906
