---
'@mastra/factory': patch
---

The session detail route `GET /web/user-sessions/:sessionId` now returns the owner profile (`owner: { id, name, avatarUrl? }`), the same field the session list routes already return. `owner` is missing when the owner has no profile in the user directory.

```ts
const { session } = await fetch(`${baseUrl}/web/user-sessions/${sessionId}`).then(response => response.json());
const isTeammateSession = session.userId !== viewerUserId;
const ownerName = session.owner?.name ?? 'a teammate';
```
