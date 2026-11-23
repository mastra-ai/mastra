---
'@mastra/core': minor
---

Added `abortReason: 'memory-failure'` to `agent_end` events. A run stopped because the observational-memory observer or reflector failed now carries it, so you can tell it apart from a person stopping the run. The `reason` stays `'aborted'`, so existing handling is unchanged. The failure itself arrives in the `error` event just before.

```ts
let lastError: Error | undefined;

session.subscribe(event => {
  if (event.type === 'error') lastError = event.error;
  if (event.type === 'agent_end' && event.reason === 'aborted' && event.abortReason === 'memory-failure') {
    console.warn(`Memory failed, run stopped: ${lastError?.message}`);
  }
});
```
