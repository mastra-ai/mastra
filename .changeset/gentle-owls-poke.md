---
'@mastra/connect': minor
---

Added Snowflake tools backed by Platform connections using the OAuth snowflake integration. Agents can run SQL statements (with async statement polling and cancellation) and browse warehouses, databases, schemas, tables, columns, views, stages, streams, tasks, roles, and users. The execute-statement tool runs any SQL the connection's Snowflake role permits, so scope the connected user to least privilege or restrict the toolset with allowTools.

```ts
import { connect } from '@mastra/connect';

const tools = connect({
  projectId: process.env.MASTRA_PROJECT_ID,
  client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
  integrations: {
    snowflake: { allowTools: ['snowflake_execute_statement', 'snowflake_list_tables'] },
  },
});
```
