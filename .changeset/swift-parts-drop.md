---
'@mastra/mongodb': patch
---

When MongoDB storage initialization fails because an existing non-unique index conflicts with Mastra's required unique index, the error now includes step-by-step migration commands instead of a generic failure message.

**Before:** `Failed to create default index on collection "mastra_threads". Set skipDefaultIndexes to manage indexes yourself.`

**After:**
```text
Index conflict on collection "mastra_threads": an existing non-unique index on { id: 1 }
conflicts with Mastra's required unique index.

To migrate:
  1. Check for duplicates:  db.mastra_threads.aggregate([{ $group: { _id: "$id", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])
  2. Drop the old index:    db.mastra_threads.dropIndex("id_1")
  3. Recreate as unique:    db.mastra_threads.createIndex({ id: 1 }, { unique: true })

Alternatively, set skipDefaultIndexes: true to manage indexes yourself.
```
