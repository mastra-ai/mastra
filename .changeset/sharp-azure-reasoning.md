---
'@mastra/core': minor
---

Fixed Azure and OpenAI Responses item handling so multi-step reasoning and tool-call histories round-trip correctly without response item ID collisions during message merging.

Added provider-neutral response item helpers to `@mastra/core/agent/message-list`. Existing in-memory message cache entries are regenerated after upgrade.
