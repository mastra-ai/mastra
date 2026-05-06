---
'@mastra/core': minor
---

Fixed Azure and OpenAI Responses item handling so multi-step reasoning and tool-call histories round-trip correctly without item ID collisions.

Added provider-neutral response item helpers to `@mastra/core/agent/message-list`. Existing in-memory message cache entries are regenerated after upgrade.
