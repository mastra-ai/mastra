---
'@mastra/pg': patch
---

Fixed numeric range filters ($gt, $gte, $lt, $lte) returning incorrect results when negated with $not on rows where the field is missing or non-numeric. The CASE guard introduced in #18430 used ELSE FALSE, which made NOT(FALSE)=TRUE incorrectly include those rows. Changed to ELSE NULL so NOT(NULL)=NULL correctly excludes them.
