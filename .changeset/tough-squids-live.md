---
'@mastra/playground-ui': patch
---

Added an `is404NotFoundError` helper to detect 404 Not Found responses from the Mastra client, alongside the existing `is401UnauthorizedError` and `is403ForbiddenError` helpers. Use it to show a clear not-found state when a resource no longer exists.

```ts
import { is404NotFoundError } from '@mastra/playground-ui';

try {
  await client.getDataset(id);
} catch (error) {
  if (is404NotFoundError(error)) {
    // show a not-found state instead of a generic error
  }
}
```
