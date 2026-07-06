---
'@mastra/deployer': minor
'@mastra/core': minor
---

Added file-system routed storage support. A `storage.ts` file under the mastra directory is now auto-discovered and registered during `mastra dev` / `mastra build`. The default export replaces the InMemoryStore fallback. Code-registered storage (passed to `new Mastra({storage})`) wins on collision.

```ts
// src/mastra/storage.ts
import { LibSQLStore } from '@mastra/libsql';

export default new LibSQLStore({ url: 'file:local.db' });
```
