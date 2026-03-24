---
'@mastra/memory': minor
---

Improved observational-memory retrieval search so `recall` search returns observation-group memories with source ranges instead of legacy message hits.

Also updated the MastraCode observation backfill script to index XML observation groups plus older plain-text observation generations more reliably, while skipping per-thread OM history read failures during rebuilds.
