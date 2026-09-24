---
'@mastra/mysql': patch
'@mastra/libsql': patch
---

Fixed skill `visibility` not being persisted by MySQL storage, so skills marked `public` are now readable by other users and returned by `list({ visibility: 'public' })`. LibSQL storage now also includes `visibility` in the skill returned from `create`.
