---
'@mastra/cloudflare': minor
'@mastra/cloudflare-d1': minor
'@mastra/convex': minor
'@mastra/dynamodb': minor
'@mastra/lance': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mssql': minor
'@mastra/mysql': minor
'@mastra/pg': minor
'@mastra/spanner': minor
'@mastra/upstash': minor
---

Persist background task ownership so recovery can be fenced on the lease.

Adds `ownerId` and `leaseExpiresAt` to the background tasks schema and honours the new `expectedOwnerId` / `expectedLeaseExpiresAt` write conditions on `updateTask()`. Existing tables are migrated in place; rows written before the upgrade carry no ownership and are treated as reclaimable.

Convex deployments must redeploy their schema and server functions: the new fields are declared as optional, but documents that carry them are rejected until the schema is pushed.
