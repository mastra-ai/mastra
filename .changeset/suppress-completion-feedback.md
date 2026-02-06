---
'@mastra/core': minor
---

**Added**
Added a `suppressFeedback` option to hide internal completion‑check messages from the stream. This keeps the conversation history clean while leaving existing behavior unchanged by default.

**Example**
Before:
```ts
const agent = await mastra.createAgent({
  completion: { validate: true }
});
```

After:
```ts
const agent = await mastra.createAgent({
  completion: { validate: true, suppressFeedback: true }
});
```