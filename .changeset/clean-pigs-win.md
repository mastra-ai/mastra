---
'@mastra/factory': patch
'mastra': patch
---

Added `GET /web/factory/projects/:id/work-items/:workItemId/session-repository`. It returns the repository a session on the card starts in, resolved with the same rules as the card's runs, or the reason the card has none.
