---
'@mastra/factory': minor
---

Added stable identities and display titles for Factory user sessions.

`POST /web/github/projects/:id/sessions` now accepts optional `sessionId` and `title` fields. When `branch` is omitted, the session uses `user/session-<sessionId>`. Callers can create a client-side draft, safely retry the first server request with the same UUID, and show the first prompt as a human-readable title. If `sessionId` is omitted, the server generates one. Explicit branches still work unchanged.

```ts
const sessionId = crypto.randomUUID();
const response = await fetch(`/web/github/projects/${projectRepositoryId}/sessions`, {
  method: 'POST',
  body: JSON.stringify({ sessionId, title: 'Fix the login flow' }),
});
```

Titles collapse whitespace, trim surrounding space, and are limited to 80 characters. Blank titles are stored as `null`.
