---
'@mastra/core': patch
---

Fixed trace aggregation returning a server error when a `having` filter used `includes` or `notIncludes`. These operators are now rejected with a validation error.
