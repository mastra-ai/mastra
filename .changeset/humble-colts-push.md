---
'@mastra/code-sdk': minor
---

Added generateThreadTitle for one-off thread titles with a cheap side model, plus resolveDefaultThreadTitleModel which reuses the OM cheap-model pack selection for the first provider with credentials. Both resolve through the mastracode gateway — stored OAuth/API keys, env fallbacks, and per-tenant request-context credentials in deployed web.

```ts
const title = await generateThreadTitle({ prompt: firstUserMessage, requestContext });
```

Provider access detection moved into a shared computeProviderAccess helper (previously inlined in createMastraCode), so startup pack resolution and any other consumer now read one source.
