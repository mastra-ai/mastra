---
'@mastra/libsql': patch
---

Added LibSQL support for the notifications storage domain so notification signals can persist thread-scoped inbox records.

```ts
import { LibSQLStore } from '@mastra/libsql';

const storage = new LibSQLStore({ url: 'file:./mastra.db' });
```
