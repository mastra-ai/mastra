Distributed Run Locks

Goal: ensure only one worker instance resumes/restarts a given workflow run at a time.

Interface
- tryAcquireWorkflowRunLock({ workflowName, runId }): boolean
- renewWorkflowRunLock({ workflowName, runId, ttlMs? }): boolean
- getWorkflowRunLock({ workflowName, runId }): { holder?: string; expiresAt?: number; backend?: string } | null
- releaseWorkflowRunLock({ workflowName, runId }): void

The core workflow engine calls these hooks around Run.resume() and Run.restart().

Supported backends

- Postgres: Fully implemented (advisory locks + metadata for TTL/heartbeat and fencing token CAS)
- InMemory: Best-effort single-process locks for tests and local runs

Other backends

The following patterns are provided for reference only; current code paths do not enforce locking or CAS on these backends. For production multi-instance deployments, use Postgres (recommended) or run a single instance.

Backend patterns

PostgreSQL (advisory locks)
- Acquire: SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS ok
- Release: SELECT pg_advisory_unlock(hashtext($1), hashtext($2))
- Keep the same client (session) checked out for the duration of the lock.
- For isometric TTL/heartbeat, a metadata table `${schema}.mastra_run_locks` tracks `holder` + `expires_at`.

LibSQL/SQLite
- Create a table mastra_run_locks(workflow_name TEXT, run_id TEXT, holder TEXT, expires_at INTEGER, PRIMARY KEY(workflow_name, run_id))
- Acquire: INSERT OR IGNORE; treat success as acquired. Optionally clear expired rows.
- Release: DELETE WHERE workflow_name/run_id/holder match.
- Renew: UPDATE expires_at
- Inspect: SELECT holder, expires_at

Upstash/Redis
- Key: mastra:runlock:{workflowName}:{runId}
- Acquire: SET key token NX PX ttl
- Release: Lua script to delete only if value == token.
- Renew: Lua script to PEXPIRE only if value == token
- Inspect: GET token + PTTL

MongoDB
- Collection: mastra_run_locks with unique index on (workflowName, runId); TTL index on expiresAt
- Acquire: insertOne({ workflowName, runId, holder, expiresAt }) catching duplicate key
- Release: deleteOne({ workflowName, runId, holder })
- Renew: updateOne to set expiresAt (holder match)
- Inspect: findOne

DynamoDB
- PK: WORKFLOW#{workflowName} SK: RUN#{runId}
- Acquire: PutItem with ConditionExpression attribute_not_exists(PK)
- Release: DeleteItem with ConditionExpression holder = :holder
- Renew: UpdateItem to set expiresAt; optional ConditionExpression on holder
- Inspect: GetItem

MSSQL
- sp_getapplock @Resource = 'workflowName:runId', @LockMode = 'Exclusive', @LockOwner='Session', @LockTimeout = 0
- sp_releaseapplock @Resource = 'workflowName:runId', @LockOwner='Session'
- For isometric TTL/heartbeat, a table `${schema}.mastra_run_locks` tracks `holder` + `expires_at`.

Notes
- Always include a TTL/expiry to avoid deadlocks on crashes.
- For session-scoped locks (PG advisory, MSSQL applock), hold the same connection until release.
- For value-based locks (Redis, SQL rows), store a random holder token and only release if the token matches.
- Engine sends automatic heartbeats every 10 minutes to extend locks to ~30 minutes by default.
