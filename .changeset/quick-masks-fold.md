---
'@mastra/pg': patch
---

Fixed observational memory date-range queries to use ISO-string timestamp columns (`createdAtZ`) instead of the raw `createdAt` column, ensuring correct filtering when querying observations by date range.
