---
'@mastra/server': patch
---

Server-side thread ownership transfer via `resourceId` reassignment.

When no middleware sets `MASTRA_RESOURCE_ID_KEY`, the thread update endpoint now accepts a `resourceId` field to transfer ownership between resources. When middleware is present, `resourceId` remains locked for multi-tenant security.

```typescript
// Transfer thread ownership from one user to another (server-side only)
const response = await fetch('/api/memory/threads/thread-123', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ resourceId: 'new-owner-id' }),
});
```

Or using the client SDK from trusted server code:

```typescript
const thread = client.getMemoryThread('my-agent', 'thread-123');
await thread.update({ resourceId: 'new-owner-id' });
```

See [#13327](https://github.com/mastra-ai/mastra/issues/13327).
