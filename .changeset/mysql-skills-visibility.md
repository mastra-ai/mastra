---
'@mastra/mysql': patch
---

Fixed skill `visibility` not being persisted by MySQL storage, so skills marked `public` are now readable by other users and returned by `list({ visibility: 'public' })`.
