---
'@mastra/pg': patch
---

Listing threads now sends one query to Postgres instead of two. Listing every thread (`perPage: false`) no longer runs a separate count, so threads filtered by metadata are scanned once instead of twice. Results are unchanged.
