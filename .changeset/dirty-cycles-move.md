---
'@mastra/core': minor
---

Added iteration-aware final output processing so processors receive the current feedback-continuation iteration as its own assistant message and can transform each iteration independently.

Fixed feedback continuations with output processors so rewrites and redactions are preserved in `getFullOutput().text` and `steps[].text` instead of returning raw earlier-iteration text.

Custom output processors that persist transcripts should use `messageList.cloneForPersistence()` to retain one assistant response with its original identity and order.

```ts
// Before: may persist processor-visible response messages separately.
const processor = {
  id: 'transcript-persister',
  processOutputResult: async ({ messages, messageList }) => {
    await saveMessages(messageList.get.response.db());
    return messages;
  },
};

// After: preserves one assistant response with its original identity and order.
const processor = {
  id: 'transcript-persister',
  processOutputResult: async ({ messages, messageList }) => {
    await saveMessages(messageList.cloneForPersistence().get.response.db());
    return messages;
  },
};
```
