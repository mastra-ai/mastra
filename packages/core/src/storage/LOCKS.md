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

Supported backends

PostgreSQL (advisory locks)
- Acquire: SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS ok
- Release: SELECT pg_advisory_unlock(hashtext($1), hashtext($2))
- Keep the same client (session) checked out for the duration of the lock.
- For isometric TTL/heartbeat, a metadata table `${schema}.mastra_run_locks` tracks `holder` + `expires_at`.

Notes
- Always include a TTL/expiry to avoid deadlocks on crashes.
- For session-scoped locks (PG advisory, MSSQL applock), hold the same connection until release.
- For value-based locks (Redis, SQL rows), store a random holder token and only release if the token matches.
- Engine sends automatic heartbeats every 10 minutes to extend locks to ~30 minutes by default.
