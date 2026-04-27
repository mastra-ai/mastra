---
'@mastra/core': minor
---

Added cron parsing helpers (`validateCron`, `computeNextFireAt`) and a `schedule` field on the evented workflow config. This is the second of several increments toward built-in scheduled workflows.

This change is config-only — workflows declaring a `schedule` will not yet fire on their own. The runtime scheduler that consumes these schedules will land in a follow-up release.

**Available now (evented engine only):**

- `WorkflowScheduleConfig` accepted on `createWorkflow({ schedule: { cron, timezone?, inputData?, initialState?, requestContext?, metadata? } })`
- Multi-schedule support: pass an **array** of `WorkflowScheduleConfig` to fire the same workflow on multiple crons or with different `inputData` per schedule. Each array entry must specify a unique stable `id` — duplicate or missing ids throw at `createWorkflow` time.
- Cron expressions are validated synchronously at workflow construction time for every entry — invalid patterns or timezones throw immediately
- `EventedWorkflow.getScheduleConfigs()` returns the declared schedules as a normalized array (empty when no schedule is declared)
- `validateCron(cron, timezone?)` and `computeNextFireAt(cron, { timezone?, after? })` exported from `@mastra/core/workflows` for adapter authors

The default-engine `Workflow` ignores the `schedule` field for now; engine-routing rules (declarative schedule on a default-engine workflow throws at `addWorkflow()`) ship alongside the scheduler component.

Adds a `croner` dependency.
