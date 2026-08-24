---
'mastra': patch
---

Gate background workers behind the 'platform-workers' rollout flag on `mastra deploy`.

Orgs not yet opted into the platform-workers rollout will have any emitted `.mastra/output/workers.json` downgraded to `null` before the artifact is uploaded, so the platform provisions no dedicated worker Railway service. The deployed app still runs its BackgroundTaskWorker in-process — background tasks execute co-located with the API replica.

**When the guard triggers** the CLI prints:

> Background workers not yet enabled for your org — deploy will run in single-process mode.

Fail-CLOSED: if PostHog is unreachable or telemetry is disabled, the guard treats the flag as OFF. This is the conservative rollout stance — orgs will only ever get dedicated workers once PostHog explicitly returns true for them. No changes are required to your `new Mastra({ backgroundTasks: ... })` config; when the flag flips ON, the next deploy uploads the manifest as-is.

Also adds a preflight check that surfaces a MISSING_ENV_VAR warning when `backgroundTasks: { enabled: true }` is set but the deploy env has no `REDIS_URL` — the platform needs Redis to coordinate the worker service with the API. The warning carries the standard `create-managed-database` (redis) autofix hint, so an interactive `mastra deploy` offers to attach a managed Redis inline before the worker rollout runs.
