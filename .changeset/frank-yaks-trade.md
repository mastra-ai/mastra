---
'@mastra/code-sdk': patch
---

`mastra/...` models now run on the Mastra Gateway key stored with a Factory tenant's model credentials, and fall back to the server-wide `MASTRA_GATEWAY_API_KEY` only when the tenant has none, so an organization with its own key pays from its own Mastra account. Web search on those models follows the same key. Stored API-key credentials can also keep the `keyId` of the key they hold, so the key can be revoked where it was created. A custom provider named like a gateway model's provider (for example `Anthropic`) no longer receives the gateway key when that model runs through the Mastra Gateway.
