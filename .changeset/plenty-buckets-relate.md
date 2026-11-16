---
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/libsql': patch
'@mastra/valkey': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/pg': patch
---

Added a batch read of workflow run ownership (#28712). `getRunOwnerships({ runIds })` returns the ownership record of each run that has one, in a `Map` keyed by run ID, with far fewer round trips than reading each run with `getRunOwnership()`.

```ts
const workflows = await storage.getStore('workflows');
const owners = await workflows?.getRunOwnerships({ runIds: ['run-1', 'run-2'] });
owners?.get('run-1')?.ownerId; // undefined when run-1 has no stored record
```

PostgreSQL reads every run in one query. LibSQL, MySQL and MSSQL send one query per 500 runs, MongoDB one per 1,000, DynamoDB one batch read per 100 and Upstash one pipeline request per 100. Redis and Valkey still read each run with its own call, but send up to 500 calls together.
