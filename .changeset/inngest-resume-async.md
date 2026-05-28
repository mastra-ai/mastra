---
'@mastra/inngest': minor
'@mastra/core': minor
'@mastra/server': patch
'@mastra/client-js': patch
---

Add `resumeAsync()` for fire-and-forget workflow resume.

Mirrors `startAsync()`: dispatches the resume event and returns immediately with `{ runId }` without awaiting the run output. For `@mastra/inngest`, this skips the `getRunOutput()` polling that previously raced a realtime subscription against the Inngest runs API and could surface spurious 404s even though the durable workflow was running fine.

- `Run.resumeAsync()` added to core (fire-and-forget, returns `{ runId }`).
- `InngestRun.resumeAsync()` sends the resume event and returns `{ runId }`, skipping polling. Send-time failures (bad payload, event send failure) still reject synchronously and roll back the snapshot.
- The server `POST /workflows/:workflowId/resume-async` and `POST /agent-builder/:actionId/resume-async` routes now return `{ runId }` instead of the full workflow result.
- The client SDK `run.resumeAsync()` now resolves with `{ runId }`.
