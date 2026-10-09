---
'@mastra/inngest': patch
---

Fixed `createInngestAgent` ignoring an external `abortSignal` when the Inngest function runs in a different process. Aborting the signal passed to `stream()` or `resumeStream()` now stops the run on the step worker, the same as `result.abort()`, so the stream ends with `finishReason: 'abort'` and `onAbort` fires.

```ts
const controller = new AbortController();
const result = await agent.stream('...', { abortSignal: controller.signal });
controller.abort(); // now stops the run on the remote worker
```
