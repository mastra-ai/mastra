---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/pg': patch
---

Fixed skill updates creating duplicate versions when a snapshot had not meaningfully changed. Comparison previously relied on `JSON.stringify`, so reordered object keys (common with PostgreSQL JSONB) or optional fields round-tripping between `undefined` and `null` looked like changes. Skill snapshots are now compared by value, so repeated no-op publish/update cycles no longer increment the version number.
