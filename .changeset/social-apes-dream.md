---
'@mastra/pg': patch
---

Made PostgreSQL observational-memory initialization atomic across processes, so concurrent callers receive the same generation-zero record.

When upgrading, `init()` now stops with a `MIGRATION_REQUIRED` error if the database already contains duplicate `(lookupKey, generationCount)` rows or an incompatible relation occupies the required index name. Reconcile the rows or replace the incompatible relation before restarting. Deployments with `disableInit: true` must add the unique `(lookupKey, generationCount)` index to their externally managed migration before updating.
