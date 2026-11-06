---
'@mastra/lance': patch
---

Fixed SQL injection in `LanceStorage` key lookups. String keys passed to `load()` (thread, message and resource IDs) went into the WHERE clause without escaping, so an ID containing `'` could change the query. Quotes are now escaped.
