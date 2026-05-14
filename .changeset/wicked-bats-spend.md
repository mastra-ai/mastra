---
'@mastra/libsql': minor
---

Added Harness v1 storage support to `@mastra/libsql`.

`LibSQLStore` now exposes `stores.harness`, backed by a `HarnessLibSQL` adapter.
The adapter persists session records with optimistic-version CAS and
lease-based ownership in a single guarded `UPDATE`, so concurrent writers
cannot both win. Attachments use a composite primary key on
`(session_id, attachment_id)` and round-trip arbitrary binary content.

```ts
const stores = await libsqlStore.getStores();
const harnessStore = stores.harness;
```
