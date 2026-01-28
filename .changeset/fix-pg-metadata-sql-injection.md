---
'@mastra/pg': patch
---

Add metadata filtering support for message queries

You can now filter messages by metadata key-value pairs, enabling efficient lookups without paginating through all messages in a thread.

**Example usage**:
```typescript
const result = await storage.listMessages({
  threadId: 'thread-123',
  filter: { metadata: { traceId: 'abc-123' } },
  perPage: 1,
});
