---
'@mastra/code-sdk': patch
---

`mastra/...` models now run on the Mastra Gateway key stored with a Factory tenant's model credentials, and fall back to the server-wide `MASTRA_GATEWAY_API_KEY` only when the tenant has none. Each organization's gateway usage is billed to its own Mastra account. Stored API-key credentials can also keep the `keyId` of the key they hold, so the key can be revoked where it was created.
