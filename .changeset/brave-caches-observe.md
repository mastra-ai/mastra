---
'@mastra/core': minor
'@mastra/memory': minor
'mastracode': patch
---

Added `activateAfterIdle: "auto"` for Observational Memory early activation.

Mastra can now choose an idle activation timeout from the active model provider's prompt cache behavior. OpenAI also respects `providerOptions.openai.promptCacheRetention` when available. MastraCode now uses `activateAfterIdle: "auto"` and shows a live idle-time counter above the input so prompt-cache windows are easier to observe.

```ts
const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      activateAfterIdle: 'auto',
      activateOnProviderChange: true,
    },
  },
})
```
