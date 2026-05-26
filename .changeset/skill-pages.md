---
'@mastra/client-js': patch
---

Add `StoredSkill.favorite()` and `StoredSkill.unfavorite()` methods, mirroring the existing `StoredAgent` favorite API. Both are idempotent and call `PUT`/`DELETE /api/stored/skills/:id/favorite`.
