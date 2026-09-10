---
'@mastra/react': minor
---

Added a `delivery` option to `useChat().sendMessage()` for queuing a separate turn or steering the active run, with local delivery feedback. Existing calls keep their send behavior. Queueing requires the thread signals transport. Waiting messages stay separate from the active response so each queued turn retains its message, tool output, and answer in order, including during history refreshes.

```ts
await sendMessage({
  mode: 'stream',
  threadId,
  message: 'Next task',
  delivery: 'queue', // Use 'steer' to guide the active run instead.
});
```
