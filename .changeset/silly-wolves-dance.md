---
'@mastra/core': minor
---

`publishSkillFromSource()` and `collectSkillForPublish()` now return a `files` field on `SkillPublishResult` containing the full file tree with base64-encoded blob content (`StorageSkillFileNode[]`). Existing callers that destructure `{ snapshot, tree }` are unaffected — the field is purely additive. Useful for storing a UI-facing copy of the skill source alongside the content-addressable blob tree.

Also adds `parseSkillSnapshotFromFiles()` and the `SkillSnapshotFile` type for parsing skill snapshot frontmatter from flat file lists.
