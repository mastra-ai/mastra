---
'@mastra/pg': patch
---

Fixed PgVector `$or` and `$nor` filters dropping field keys that sit next to a nested logical operator. In `{ $or: [{ $and: [{ a: 1 }], c: 2 }, { d: 3 }] }` the `c` condition was ignored. It is now combined with the nested `$and`.
