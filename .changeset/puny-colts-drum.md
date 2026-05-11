---
'@mastra/mssql': minor
---

Add agents storage domain to MSSQL adapter — brings @mastra/mssql to parity with @mastra/mongodb and @mastra/libsql for the agents domain. The Studio "Agents" tab and `mastra.getEditor()` now work against MSSQL.

```ts
import { MSSQLStore } from '@mastra/mssql';

const store = new MSSQLStore({
  id: 'mssql-storage',
  connectionString: process.env.MSSQL_URL!,
});

const agents = await store.getStore('agents');
const agent = await agents?.getById('agent-id');
const page = await agents?.list({ status: 'published', perPage: 20 });
```
