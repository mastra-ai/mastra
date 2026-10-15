---
'@mastra/memory': minor
---

Observational Memory now recovers automatically when a model provider rejects a request for exceeding its context window ([#21657](https://github.com/mastra-ai/mastra/issues/21657)).

A provider can count more tokens than Observational Memory's own estimate (attachments, formatting, or switching to a model with a smaller window), so a request can overflow before the observation threshold is reached. Previously the agent's request just failed. Now Observational Memory observes everything still pending and retries once with the smaller context. No configuration is needed. Automatic recovery needs a `@mastra/core` version that includes `MastraMemory.getErrorProcessors()`; with an older core, the error reaches the caller as before. To turn it off:

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      observation: { observeOnContextOverflow: false },
    },
  },
});
```

`observe()` also accepts `force: true` to observe pending messages regardless of the threshold, for that call only.
