---
'@mastra/memory': minor
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Observational memory's `'auto'` model can now follow the credentials a request can actually use. Pass `canUseProvider` in the observational memory config to decide whether `'auto'` prefers Gemini, instead of relying on `GOOGLE_GENERATIVE_AI_API_KEY` in the server environment:

```ts
new Memory({
  options: {
    observationalMemory: {
      model: 'auto',
      canUseProvider: (providerId, { requestContext }) => hasCredential(requestContext, providerId),
    },
  },
});
```

Factory now uses this, so signed-in accounts on Auto memory get a model from a provider they connected. Previously, a server with a Google key made Auto pick Gemini for accounts without a Google credential, and memory failed with "No usable google credential". The memory settings preview shows the same model that runs use.
