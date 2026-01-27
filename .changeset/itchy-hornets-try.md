---
'@mastra/agent-builder': patch
---

Fixed latent Memory storage bug in AgentBuilder. AgentBuilder was created without providing storage to Memory, causing intermittent failures when Memory operations were invoked. Now uses InMemoryStore as a fallback when no storage is provided, allowing it to function without explicit storage configuration.
