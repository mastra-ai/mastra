---
'@mastra/libsql': minor
---

Added `HarnessLibSQL` adapter implementing the new `HarnessStorage` domain. Wired into `LibSQLStore` as `stores.harness`. Persists SessionRecords with optimistic-version CAS and lease-based ownership in a single `UPDATE ... WHERE` statement so concurrent writers cannot both succeed. Attachments use a composite primary key on `(session_id, attachment_id)` and round-trip arbitrary binary content. This is internal infrastructure — no public-facing API yet.
