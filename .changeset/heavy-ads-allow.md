---
'@mastra/elasticsearch': minor
---

**Added** API key, basic, and bearer authentication options for Elasticsearch connections.

**Changed** vector IDs now come from Elasticsearch `_id`; stored `id` fields are no longer written (breaking if you relied on `source.id`).

**Why** This aligns with Elasticsearch auth best practices and avoids duplicate IDs in stored documents.

**Before**
```ts
const store = new ElasticSearchVector({ url, id: 'my-index' });
```

**After**
```ts
const store = new ElasticSearchVector({
  url,
  id: 'my-index',
  auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! },
});
```
