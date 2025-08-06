---
'@mastra/core': patch
---

Fix tool call history not being accessible in agent conversations

When converting v2 messages (with combined tool calls and text) to v1 format for memory storage, split messages were all keeping the same ID. This caused later messages to replace earlier ones when added back to MessageList, losing tool history.

The fix adds ID deduplication by appending `__split-N` suffixes to split messages and prevents double-suffixing when messages are re-converted between formats.
