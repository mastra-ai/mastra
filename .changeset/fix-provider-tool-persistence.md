---
'@mastra/core': patch
---

Fixed provider-executed tool calls (e.g. Anthropic `web_search`) being dropped or incorrectly persisted when deferred by the provider. Tool call parts are now persisted in stream order, and deferred tool results are correctly merged back into the originating message.
