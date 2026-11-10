---
'@mastra/code-sdk': patch
---

`mastra/...` models now run on the Mastra Gateway key stored with a Factory tenant's model credentials, and fall back to the server-wide `MASTRA_GATEWAY_API_KEY` only when the tenant has none, so an organization with its own key pays from its own Mastra account. Web search on those models follows the same key. When a model runs through the Mastra Gateway, its key no longer reaches a custom provider named like the model's provider (for example `Anthropic`) or Moonshot's own API.
