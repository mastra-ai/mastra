---
'@mastra/client-js': minor
---

Added `getRootSpanJsonKeys` and `getLogJsonKeys` on `MastraClient` (and on the `Observability` resource). Returns the distinct top-level keys present on root-span `metadata`/`attributes` or log `metadata`/`data` — useful for building custom-column pickers or any UI that needs to discover what fields a project stores in observability records.

```ts
const { keys } = await client.getRootSpanJsonKeys({ field: 'metadata' });
// keys: ['organizationId', 'tenantId', 'userId', ...]

const { keys: dataKeys } = await client.getLogJsonKeys({ field: 'data' });
```
