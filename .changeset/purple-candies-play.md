---
'@mastra/core': minor
---

Added a FactoryStorage contract that owns application storage domains, initializes them with the shared backend, and reports per-domain readiness and initialization errors.

```ts
import { FactoryStorageDomain } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';

class TasksStorage extends FactoryStorageDomain {
  constructor() {
    super('tasks');
  }

  async init() {
    await this.ensureCollections([{ name: 'tasks', columns: { id: { type: 'uuid-pk' } } }]);
  }

  async dangerouslyClearAll() {
    await this.ops.deleteMany('tasks', {});
  }
}

const storage = new LibSQLFactoryStorage({ url: 'file:mastra.db' });
storage.registerDomain(new TasksStorage());
await storage.init();
```
