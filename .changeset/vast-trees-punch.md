---
'@mastra/memory': minor
---

Added `activateOnProviderChange` so observational memory can activate buffered observations and reflections before switching to a different provider or model.

```ts
const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      activateOnProviderChange: true,
    },
  },
});
```

This helps keep prompt-cache savings when the next step cannot reuse the previous provider's cache.
