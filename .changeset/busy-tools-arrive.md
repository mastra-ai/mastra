---
'@mastra/core': minor
---

Added an experimental Knowledge v2 storage contract. A Knowledge store can now report what it supports, check whether existing tables match the current schema, and clear Knowledge data without touching other storage domains.

```ts
const knowledge = storage.stores?.knowledge;
if (knowledge?.getCapabilities().supportsSchemaInspection) {
  const schema = await knowledge.inspectSchema();
  if (schema.status === 'incompatible-reset-required') {
    console.warn(schema.reason);
  }
}
```
