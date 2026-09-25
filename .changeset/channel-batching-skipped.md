---
'@mastra/core': patch
---

Fixed channel messages being dropped when `chatOptions.concurrency` uses `burst`, `debounce`, or `queue`. Messages the Chat SDK batches together now reach the agent as one turn, oldest first, and are saved to memory. Only messages from the current sender are merged; custom channel handlers can read every batched message from `context.skipped`. Fixes #22496.

```ts
channels: {
  adapters: { whatsapp },
  chatOptions: { concurrency: 'debounce' },
  handlers: {
    onDirectMessage: async (thread, message, defaultHandler, context) => {
      console.log(`${context.skipped.length} earlier messages batched`);
      await defaultHandler(thread, message);
    },
  },
}
```
