---
'@mastra/server': patch
---

Restore backwards compatibility for the legacy `GET /api/memory/threads?orderBy=<field>&sortDirection=<dir>` query shape emitted by `@mastra/client-js` < 1.18 (and any hand-rolled HTTP clients written against pre-1.0 docs). Server 1.31.0 turned that shape into a hard 400 (`Invalid input: expected object, received undefined`); the legacy bare-string + `sortDirection` pair is now transparently fused into the current `{ orderBy: { field, direction } }` object shape before validation, so pinned clients keep working.

Current callers using bracket notation (`orderBy[field]=...&orderBy[direction]=...`) or a JSON-stringified `orderBy` are unaffected.
