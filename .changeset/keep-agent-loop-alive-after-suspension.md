---
"@mastra/core": patch
"@mastra/libsql": patch
---

Keep the agent loop alive after a tool suspension (e.g. `ask_user`, `request_access`).

Two related fixes that stop the agent from appearing to quit mid-task right after a suspended tool resumes:

- **Harness resume step budget**: `resumeStream()` was called without a step budget, so a resumed run merged over the agent's small default `maxSteps` and stopped after a single step. The harness now threads a shared set of run options (`maxSteps`, `savePerStep`, `modelSettings`, etc.) into both the initial stream and the resume via one helper, so the two paths can no longer drift.
- **LibSQL `busy_timeout` survival**: bump `@libsql/client` to `^0.17.4` and add a configurable connection timeout so `PRAGMA busy_timeout` survives connections created after `transaction()` (libsql-client-ts#288/#345). This reduces `SQLITE_BUSY` retry-exhaustion stalls under the evented engine's concurrent writes.
