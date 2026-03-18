---
'@mastra/pg': patch
---

Fix concurrent query deprecation warning in PostgreSQL transactions

Replaced `Promise.all()` with sequential `await` loops in two locations within `saveMessages()` and `deleteMessages()` methods. This prevents concurrent queries on the same pg client within transactions, which was triggering deprecation warnings in pg@8.19+ and would break in pg@9.0.

Fixes #14481
