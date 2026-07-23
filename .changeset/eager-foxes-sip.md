---
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mongodb': minor
'@mastra/upstash': minor
'@mastra/dynamodb': minor
'@mastra/mssql': minor
'@mastra/cloudflare-d1': minor
'@mastra/clickhouse': minor
'@mastra/lance': minor
'@mastra/dsql': minor
'@mastra/mysql': minor
'@mastra/redis': minor
---

Memory list reads now surface database errors instead of silently returning empty results.

Previously, the paginated memory reads (`listThreads`, `listMessages`, `listMessagesByResourceId`) caught backend failures, logged them, and returned an empty payload like `{ threads: [], total: 0, hasMore: false }`. A transient outage (locked table, dropped connection) was therefore indistinguishable from a genuinely empty result, so an agent reading conversation history during a brief failure would treat it as "no history" and could overwrite real state. These methods now re-throw the failure as a `MastraError`. Validation (USER) errors and genuinely empty results are unchanged.

**Behavior change**

Callers that previously received an empty result on a backend failure will now receive a thrown `MastraError`. If you call these read methods directly (rather than through an agent, which already surfaces errors), wrap them so a transient outage doesn't crash the caller:

```ts
try {
  const { threads } = await storage.listThreads({ resourceId });
  // ...use threads
} catch (error) {
  // a real backend failure. Decide whether to retry, surface, or degrade.
  // An empty thread list no longer hides here; it only means "no threads".
}
```
