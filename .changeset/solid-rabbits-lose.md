---
'@mastra/core': patch
---

Fixed a bug where message-level `providerOptions` could be lost or applied to the wrong turn after tool calls. Anthropic `cacheControl` markers now stay attached to the intended message in tool-using conversations.
