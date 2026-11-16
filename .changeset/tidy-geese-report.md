---
'@mastra/core': minor
---

Added `ModelRouterLanguageModel.isGatewayMemoryManaged()`. It reports whether the Mastra Gateway serves Observational Memory for the credential the model will use, so framework code can keep memory local when the gateway can't serve it. A gateway project key is served by the gateway. An organization key (`msk-gateway-…`, `mskv2_…`) is served by a gateway without the memory API. A credential that can't be resolved — including one the gateway reports as missing — is thrown instead of reported as local, so a caller never mistakes a failed lookup for local ownership and the gateway and the local store can't both save the same conversation ([#30391](https://github.com/mastra-ai/mastra/issues/30391)).

```typescript
const model = new ModelRouterLanguageModel('mastra/openai/gpt-6.1-sol');

if (await model.isGatewayMemoryManaged()) {
  // The gateway stores the thread's observations.
} else {
  // Memory has to stay local.
}
```
