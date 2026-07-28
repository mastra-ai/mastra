---
'@mastra/core': patch
---

Fixed four bugs affecting split API and worker deployments:

**Workflow resolution in distributed step execution** — Workers now correctly resolve workflows by their internal ID, fixing silent failures when workflow IDs differ from their registration keys.

**Background task dispatch without worker competition** — Added a `mode` option (`'full'` | `'producer'` | `'worker'`) to `BackgroundTaskManager` so the API tier can dispatch tasks without consuming them. Mastra automatically selects `'producer'` mode when workers are disabled or filtered.

**Background task execution engine** — Background tasks now execute in-process on the worker that picks them up, instead of routing through the distributed orchestration pipeline.

**Agent tool registration for background tasks** — Tools attached to an agent are now registered with the background task executor registry, so dedicated workers can resolve and execute them.
