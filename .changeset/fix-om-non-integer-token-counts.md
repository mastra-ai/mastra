---
'@mastra/memory': patch
'@mastra/pg': patch
---

Fixed observational memory writing non-integer token counts to PostgreSQL, which caused `invalid input syntax for type integer` errors. Token counts are now correctly rounded to integers before all database writes.
