---
'@mastra/memory': minor
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
