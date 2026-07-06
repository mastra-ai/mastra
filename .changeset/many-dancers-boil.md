---
'@mastra/core': minor
---

Added `onTitleGenerated` callback to agent execution options. When `generateTitle` is enabled, pass `onTitleGenerated` to `agent.generate()` or `agent.stream()` to be notified when the thread title has been generated and persisted to storage. This is a per-request callback (like `onFinish`), so each request handler can use its own callback with direct access to its response stream — no storage adapter wrapping needed.

**Example:**

```ts
await agent.stream('Hello', {
  memory: { thread: threadId, resource: userId },
  onTitleGenerated: (title) => {
    res.write(`event: title\ndata: ${JSON.stringify({ title })}\n\n`);
  },
});
```
