---
'@mastra/core': patch
---

Added the saved view schemas (`savedViewStateSchema`, `savedViewStateEnvelopeSchema`, `SAVED_VIEW_STATE_MAX_BYTES` and related types) to the browser-safe `@mastra/core/storage/dashboards` entry, so browser apps can validate a saved view before sending it.

```ts
import { savedViewStateSchema } from '@mastra/core/storage/dashboards';

const result = savedViewStateSchema.safeParse({
  schemaVersion: 1,
  page: 'traces',
  filters: [{ fieldId: 'status', value: 'error' }],
});
if (!result.success) console.error(result.error.issues);
```
