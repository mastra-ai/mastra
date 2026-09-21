---
'@mastra/server': patch
---

Fixed workspace query flags treating the string "false" as `true`. Passing `recursive=false` or `force=false` on filesystem list/delete requests, or `includeReferences=false` on skill search, is now honored instead of being flipped on.

These flags arrive over HTTP as strings, and the client SDK serializes an explicit `false` as `"false"`. The schemas used `z.coerce.boolean()`, which applies JavaScript truthiness, so `"false"` became `true` — silently enabling recursive deletion or forced deletes a caller had turned off. The schemas now map `"true"`/`"false"` strings correctly.
