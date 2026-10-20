---
'@mastra/factory': minor
---

Added an endpoint for session owners to share a private session with their organization or make it private again. Sharing moves the session's conversation onto its Factory's memory, and making it private moves it back to the owner's. Only the owner can change visibility; other users get "not found", and a session that is running must finish first. Factory run sessions and Slack thread sessions keep the visibility they were created with.

```ts
await fetch(`/web/user-sessions/${sessionId}/visibility`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ visibility: 'org' }), // or 'private'
});
```
