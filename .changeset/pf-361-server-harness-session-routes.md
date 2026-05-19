---
'@mastra/server': patch
---

Added authenticated Harness session lifecycle APIs for server clients. Developers can now list sessions, create or resolve a session, read a snapshot, and close a session through the Harness server surface while preserving resource-scoped access checks.

```ts
const sessions = await fetch('/api/harness/code/sessions', {
  headers: { Authorization: `Bearer ${token}` },
});

const created = await fetch('/api/harness/code/sessions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ threadId: 'thread-1', modeId: 'default', modelId: 'gpt-4o' }),
});

const snapshot = await fetch('/api/harness/code/sessions/session-1', {
  headers: { Authorization: `Bearer ${token}` },
});

await fetch('/api/harness/code/sessions/session-1', {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
});
```
