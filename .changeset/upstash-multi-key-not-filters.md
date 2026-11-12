---
'@mastra/upstash': patch
---

Fixed Upstash vector filters with multi-key `$not`, `$nor`, and negated `$and`/`$or` conditions silently ignoring every key after the first. For example, `{ price: { $not: { $gte: 10, $lte: 20 } } }` now matches prices outside the range instead of only prices below 10, so queries, updates, and deletes no longer match the wrong vectors.
