---
'@mastra/core': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
---

Added a schema for saved observability list views. `savedViewStateSchema` describes a saved copy of the traces, spans, threads or logs page state (filters, time range, sort, columns and page options), and `savedViewStateEnvelopeSchema` checks only the schema version, the page and the 16 KiB size limit, for services that store views without reading them. The filter shape is exported on its own as `filterNodeSchema`; it accepts any operator id, so new operators don't need a schema change.

```ts
import { savedViewStateSchema } from '@mastra/core/storage';

savedViewStateSchema.parse({
  schemaVersion: 1,
  page: 'traces',
  filters: [{ fieldId: 'status', value: 'error' }],
  dateRange: { preset: 'last-24h' },
  sort: { field: 'startedAt', direction: 'desc' },
});
```
