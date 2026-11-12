---
'@mastra/pg': patch
---

Apply every nested `$elemMatch` operator when filtering PostgreSQL vectors, so searches and deletions honor all bounds on the same array element.
