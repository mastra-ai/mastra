---
'@mastra/core': patch
---

Fixed provider-executed tool calls (e.g. Anthropic `web_search`) being incorrectly handled when deferred by the provider. Tool call parts are now persisted in stream order instead of being batched at the end of messages. Added `MessageList.updateToolInvocation()` for in-place tool state transitions (`call` → `result`), replacing the old pattern of adding separate result messages. Fixed output converter stripping completed provider-executed tool results from outbound prompts.
