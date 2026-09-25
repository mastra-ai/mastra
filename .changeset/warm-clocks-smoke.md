---
'@mastra/memory': minor
---

Added `compact()` to Observational Memory to recover from provider context-window errors ([#21657](https://github.com/mastra-ai/mastra/issues/21657)).

A provider can reject a request for exceeding its context window while Observational Memory's own token estimate is still below the observation threshold. In that case `observe()` and `finalize()` do nothing, and lowering the threshold with `updateRecordConfig()` saves the lower value on the thread permanently. `compact()` ignores the threshold for one call only and summarizes the oldest pending messages, all of them by default. When you pass the request's `messageList`, the summarized messages are also removed from it so the retry is smaller, while the user's current prompt is saved and kept.

```typescript
const recovery: Processor = {
  id: 'context-overflow-recovery',
  async processAPIError({ error, retryCount, messageList, requestContext }) {
    if (retryCount > 0 || !isContextOverflow(error)) return;
    const context = om.getThreadContext(requestContext, messageList);
    if (!context) return;
    const result = await om.compact({ ...context, messageList, requestContext });
    return { retry: result.compacted };
  },
};
```
