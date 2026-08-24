---
'@mastra/client-js': minor
---

Added custom trace signal names and server-provided signal catalog types to Trace Intelligence responses.

```ts
import type { ThemeEntitiesResponse } from '@mastra/client-js';

function signalLabels(response: ThemeEntitiesResponse) {
  return response.entities[0]?.signalCatalog?.map(signal => signal.label) ?? [];
}
```
