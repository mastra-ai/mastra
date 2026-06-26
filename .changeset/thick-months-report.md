---
'@mastra/pg': patch
---

Negated numeric range filters (`$not` with `$gt`, `$gte`, `$lt`, `$lte`) now correctly exclude rows where the filtered field is missing or non-numeric. Previously these rows were incorrectly included in results.
