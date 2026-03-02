---
'@mastra/client-js': minor
---

Added `requestContext`, `defaultRequestContext`, and `requestContextSchema` fields to dataset client SDK types.

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient();

// Create dataset with request context schema
await client.createDataset({
  name: 'my-dataset',
  defaultRequestContext: { authorization: 'Bearer xxx' },
  requestContextSchema: { type: 'object', properties: { authorization: { type: 'string' } } },
});

// Add item with request context
await client.addDatasetItem('dataset-id', {
  input: { query: 'hello' },
  requestContext: { authorization: 'Bearer yyy' },
});
```
