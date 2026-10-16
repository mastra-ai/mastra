---
'@mastra/factory': minor
---

Added an endpoint for session owners to share a private session with their organization or make it private again. Only the owner can change visibility; other users get "not found". Factory run sessions and Slack thread sessions keep the visibility they were created with.

```ts
await fetch(`/web/user-sessions/${sessionId}/visibility`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ visibility: 'org' }), // or 'private'
});
```
