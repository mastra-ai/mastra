---
'@mastra/inngest': minor
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Add fire-and-forget workflow resume that returns immediately with `{ runId }` without awaiting the run output.

For `@mastra/inngest`, this skips the `getRunOutput()` polling that previously raced a realtime subscription against the Inngest runs API and could surface spurious 404s even though the durable workflow was running fine.

- `Run.resumeAsync()` added to core: dispatches the resume in the background and returns `{ runId }` immediately. Engines that poll for results (Inngest) override it to skip polling entirely.
- `InngestRun.resumeAsync()` sends the resume event and returns `{ runId }`, skipping polling. Send-time failures (bad payload, event send failure) still reject synchronously and roll back the snapshot.
- New `POST /workflows/:workflowId/resume-no-wait` and `POST /agent-builder/:actionId/resume-no-wait` routes return `{ runId }` immediately.
- New client SDK `run.resumeNoWait()` resolves with `{ runId }`.

The existing `resumeAsync()` client/server surface is unchanged and still resolves with the full workflow result, so there is no breaking change.

`resumeNoWait` is intentionally additive in v1. In Mastra v2 the fire-and-forget behavior is planned to become the default behavior of `resumeAsync()` (mirroring `start`/`resume` semantics), at which point `resumeNoWait` and the `resume-no-wait` routes will be removed. The code paths carry `TODO(v2)` comments documenting this consolidation.
