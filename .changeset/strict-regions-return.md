---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/server': patch
---

Added storage type detection to the Metrics Dashboard. The `/system/packages` endpoint now returns `observabilityStorageType`, identifying the observability storage backend. The dashboard shows an empty state when the storage does not support metrics (e.g. PostgreSQL, LibSQL), and displays a warning when using in-memory storage since metrics are not persisted across server restarts. Also added a docs link button to the Metrics page header.

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient();
const system = await client.getSystemPackages();

// system.observabilityStorageType contains the class name of the observability store:
// - 'ObservabilityStorageClickhouse' → full metrics support
// - 'ObservabilityInMemory'          → metrics work but are not persisted across restarts
// - 'ObservabilityPG', 'ObservabilityLibSQL', etc. → metrics not supported

if (system.observabilityStorageType === 'ObservabilityInMemory') {
  console.warn('Metrics are not persisted — data will be lost on server restart.');
}

const SUPPORTED = new Set(['ObservabilityStorageClickhouse', 'ObservabilityInMemory']);
if (!SUPPORTED.has(system.observabilityStorageType ?? '')) {
  console.error('Metrics require ClickHouse, DuckDB, or in-memory observability storage.');
}
```
