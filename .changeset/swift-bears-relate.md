---
'@mastra/factory': minor
---

Added an endpoint for session owners to share a private session with their organization or make it private again: `PUT /web/user-sessions/:sessionId/visibility` with `{ "visibility": "org" }` or `{ "visibility": "private" }`. Only the owner can change visibility; other users get "not found".
