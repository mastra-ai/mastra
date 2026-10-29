---
'@mastra/core': minor
---

Added schemas for saved observability list views. Use `savedViewStateSchema` to validate a saved traces, spans, threads or logs view: its filters, time range, sort, columns and page options. A service that only stores views can use `savedViewStateEnvelopeSchema` instead. It checks the version, the page and the 16 KiB size limit. Dashboards can reuse the filter shape through `filterNodeSchema`. It accepts any operator id, so new operators don't need a schema change.

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
