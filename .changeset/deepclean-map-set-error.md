---
'@mastra/observability': patch
---

`deepClean()` now preserves data for `Map`, `Set`, and richer `Error` objects. Previously Maps and Sets were serialized as empty `{}` (entries silently dropped) and Errors only kept `name`/`message`. Maps are now converted to plain objects of entries, Sets to arrays (both respecting `maxObjectKeys`/`maxArrayLength` and cycle detection), and Errors additionally preserve `stack` and recursively cleaned `cause`.
