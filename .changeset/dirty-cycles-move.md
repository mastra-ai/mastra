---
'@mastra/core': minor
---

Added separate response messages for the current iteration in final output processors, allowing processors to transform each iteration independently.

Processors that persist transcripts should use `messageList.cloneForPersistence()` because the current iteration may appear as a temporary separate response message during final output processing.

```ts
// Before: may persist the temporary split response.
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
