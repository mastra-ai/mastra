---
'@mastra/core': minor
---

Added cron parsing helpers (`validateCron`, `computeNextFireAt`) and a `schedule` field on the evented workflow config. This is the second of several increments toward built-in scheduled workflows.

This change is config-only — workflows declaring a `schedule` will not yet fire on their own. The runtime scheduler that consumes these schedules will land in a follow-up release.

**Available now (evented engine only):**

- `WorkflowScheduleConfig` accepted on `createWorkflow({ schedule: { cron, timezone?, inputData?, initialState?, requestContext?, metadata? } })`
- Cron expressions are validated synchronously at workflow construction time — invalid patterns or timezones throw immediately
- `EventedWorkflow.getScheduleConfig()` returns the declared schedule (used by the upcoming scheduler component to register declarative schedules at boot)
- `validateCron(cron, timezone?)` and `computeNextFireAt(cron, { timezone?, after? })` exported from `@mastra/core/workflows` for adapter authors

The default-engine `Workflow` ignores the `schedule` field for now; engine-routing rules (declarative schedule on a default-engine workflow throws at `addWorkflow()`) ship alongside the scheduler component.

Adds a `croner` dependency.
