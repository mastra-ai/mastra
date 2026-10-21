---
'@mastra/factory': patch
---

Fixed the `ModelCatalogEntry` type to match what `GET /web/config/models` returns: `modelName` is always present and `reasoningOptions` may be absent. `ModelCredentialHolder` is now exported, so clients can type the `credentialHolder` field without copying it.
