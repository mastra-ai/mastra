---
'@mastra/elasticsearch': minor
---

Added discriminated union type for ElasticSearchVector constructor config. You can now pass either `{ id, client }` with a pre-configured `@elastic/elasticsearch` Client, or `{ id, url, auth? }` with connection parameters. The type system enforces that exactly one variant is used, preventing invalid combinations at compile time.

**Using connection parameters:**

```typescript
const vectorDB = new ElasticSearchVector({
  id: 'my-store',
  url: 'http://localhost:9200',
  auth: { apiKey: 'my-key' },
});
```

**Using a pre-configured client:**

```typescript
import { Client } from '@elastic/elasticsearch';

const client = new Client({ node: 'http://localhost:9200' });
const vectorDB = new ElasticSearchVector({ id: 'my-store', client });
```
