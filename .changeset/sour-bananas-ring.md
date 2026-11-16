---
'@mastra/convex': patch
---

Fixed Convex vector queries applying only the first operator in a field condition. A filter such as `{ score: { $gte: 1, $lte: 10 } }` now checks every operator, `$eq` is supported, and unsupported operators match nothing instead of being skipped.
