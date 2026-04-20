---
'@mastra/libsql': patch
---

Fixed Editor-saved agent drafts disappearing after a server restart. The parent agent row is now linked to its initial version on create, and the stale-draft cleanup only removes truly orphaned rows (drafts with no associated versions) instead of wiping every draft without an `activeVersionId`.
