---
'@mastra/server': minor
---

Studio now reports a provider as connected when a registered gateway authenticates it through OAuth or stored credentials, for example the Mastra Code gateway with a ChatGPT subscription login. The providers list and the instructions enhancer resolve auth through the same gateway chain the model router uses instead of re-implementing environment variable checks. `@mastra/server` now requires `@mastra/core` 1.68.0 or newer. The `isProviderConnected` export of `@mastra/server/handlers/agents` is removed; use `GatewayManager.hasProviderAuth()` from `@mastra/core/llm`. Fixes #23668
