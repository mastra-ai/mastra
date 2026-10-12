---
'@mastra/factory': minor
---

Added ownership transfer for Factory source-control sessions. An organization member can take over an org-visible session. The session retains its original creator, and the transfer is recorded in the audit log.

```ts
await fetch(`/web/user-sessions/${sessionId}/owner`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ expectedOwnerId: currentOwnerId }),
});
```
