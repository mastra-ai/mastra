---
'@mastra/core': minor
---

Keep one user message when recorded speech is later delivered to the same Session with attachments. Recording a turn does not start an agent run. Late transcripts preserve the delivered signal and its files, and repeated delivery of the same live input returns its existing receipt.

```typescript
await session.recordMessage({ id: 'spoken-1', role: 'user', content: 'Read this file.' });
const receipt = session.sendMessageWithReceipt({
  id: 'spoken-1',
  content: 'Read this file.',
  files: [{ data: 'Document text', mediaType: 'text/plain', filename: 'notes.txt' }],
});
await receipt.accepted;
```

Identified delivery requires a bound thread and shared agent/controller memory storage. IDs are scoped to one conversation and role. Live receipts are bounded; after eviction or Session recreation, already persisted signals reject uncertain replay instead of starting another run. Rejected delivery may be retried. Calls without an ID retain their existing behavior.
