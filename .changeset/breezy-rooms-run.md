---
'@mastra/mongodb': patch
---

Added notification inbox storage support for MongoDB stores.

```ts
import { MongoDBStore } from '@mastra/mongodb';

const storage = new MongoDBStore({ url: process.env.MONGODB_URI!, dbName: 'mastra' });
```

Agents using this store can persist thread-scoped notification inbox records for notification signals.
