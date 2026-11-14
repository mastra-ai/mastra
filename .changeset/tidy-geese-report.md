---
'@mastra/core': minor
---

Added `ModelRouterLanguageModel.isGatewayMemoryManaged()`. It reports whether the Mastra Gateway serves Observational Memory for the credential the model will use, so framework code can keep memory local when the gateway can't serve it. A gateway project key is served by the gateway. An organization key (`msk-gateway-…`, `mskv2_…`) is served by a gateway without the memory API, and a credential that can't be resolved reports `false` rather than throwing ([#30391](https://github.com/mastra-ai/mastra/issues/30391)).

```typescript
const model = new ModelRouterLanguageModel('mastra/openai/gpt-6.1-sol');

if (await model.isGatewayMemoryManaged()) {
  // The gateway stores the thread's observations.
} else {
  // Memory has to stay local.
}
```
