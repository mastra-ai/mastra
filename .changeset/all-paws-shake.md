---
'@mastra/mongodb': patch
---

Fixed MongoDB vector store docs and exported `MongoDBQueryVectorParams` type.

**What changed**

- Removed the `minScore` parameter from the `query()` reference docs and README. It was incorrectly listed but never supported by the SDK (only `@mastra/pg` and `@mastra/libsql` implement it).
- Exported the `MongoDBQueryVectorParams` interface so you can type query parameters that include the MongoDB-specific `documentFilter` field.

**Before**

```typescript
import { MongoDBVector } from '@mastra/mongodb';

// MongoDBQueryVectorParams was not exported, so TypeScript fell back to
// QueryVectorParams<any> and rejected documentFilter
const params = {
  indexName: 'docs',
  queryVector: [0.1, 0.2, 0.3],
  documentFilter: { $contains: 'mongodb' },
};
await store.query(params); // TS error on documentFilter
```

**After**

```typescript
import { MongoDBVector, MongoDBQueryVectorParams } from '@mastra/mongodb';

const params: MongoDBQueryVectorParams = {
  indexName: 'docs',
  queryVector: [0.1, 0.2, 0.3],
  documentFilter: { $contains: 'mongodb' },
};
await store.query(params);
```

Fixes #15715
