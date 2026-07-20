---
'@mastra/libsql': minor
---

Added LibSQLFactoryStorage for persisting Mastra agent state and lifecycle-managed application domains through one LibSQL connection.

```ts
import { LibSQLFactoryStorage } from '@mastra/libsql';

const storage = new LibSQLFactoryStorage({ url: 'file:mastra.db' });
await storage.init();
```
