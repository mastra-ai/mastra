---
'@mastra/oracledb': patch
---

The Oracle observability store now declares its logs and filter discovery support (entity types, entity names, service names, environments and tags), so Studio can show the matching filters.

```ts
const { capabilities } = await client.getObservabilityCapabilities();
capabilities.logs; // true
capabilities.discovery.entityNames; // true
```
