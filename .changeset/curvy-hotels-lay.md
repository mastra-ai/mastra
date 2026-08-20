---
'@mastra/core': minor
---

Added graceful shutdown options for generated servers ([#20678](https://github.com/mastra-ai/mastra/issues/20678)). Configure how long in-flight HTTP requests may drain, or disable Mastra's built-in signal handlers when managing the server lifecycle yourself.

```ts
export const mastra = new Mastra({
  server: {
    drainTimeout: 600_000,
    handleShutdownSignals: false,
  },
});
```
