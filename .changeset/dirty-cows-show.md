---
'@mastra/factory': patch
---

The session detail route `GET /web/user-sessions/:sessionId` now returns the owner profile (`owner: { id, name, avatarUrl? }`), the same field the session list routes already return.
