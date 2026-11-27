---
'@mastra/libsql': patch
---

Vector metadata filters now respect the stored JSON type of each value. A filter like `{ flag: false }` no longer also matches the number `0` (or `true` matching `1`), an explicit `null` no longer matches rows where the key is missing, `$ne` only compares values of the same type, and numeric comparisons such as `$gt`/`$lt` ignore booleans and strings. The same fix covers filtered updates and filtered deletes, so `updateVector` and `deleteVectors` no longer touch rows whose value merely looks equal after a loose comparison.
