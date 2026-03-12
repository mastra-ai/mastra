---
'@mastra/elasticsearch': minor
---

Added support for constructing `ElasticSearchVector` with a pre-configured Elasticsearch client. You can now pass either a `client` instance or connection parameters (`url` and optional `auth`), giving you full control over client configuration when needed.

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
