---
'@mastra/core': minor
---

Added `logicalMessageIdentity` so callers can associate saved input and response segments with their own message identities across model steps and durable recovery. Native storage rows keep their unique IDs. Omit the option to preserve existing behavior.

```ts
// Existing call: native message IDs only.
await session.message({ content: 'Summarize the selected paper.' });

// Associate this input and every response segment with application message IDs.
await session.message({
  content: 'Summarize the selected paper.',
  logicalMessageIdentity: {
    input: 'app-message-input-123',
    response: 'app-message-response-123',
  },
});
```

The full input/response pair starts a new response and discards an active-run steer. Input-only signals preserve the active response identity. Recalled memory rows retain their existing ownership.
