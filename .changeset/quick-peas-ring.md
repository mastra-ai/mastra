---
'@mastra/core': patch
---

Fixed resumed suspended tools re-saving earlier turns' parts into new assistant messages. When a suspended tool (e.g. a sub-agent delegation using autoResumeSuspendedTools) was resumed, previously saved assistant messages were merged into the current response, so each resume duplicated earlier turns' tool calls and text in storage. Messages that already exist earlier in the list are now updated in place instead of being merged into the latest response, so each tool call is saved in exactly one message.
