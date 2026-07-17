---
'@mastra/core': patch
---

Fixed four bugs affecting distributed worker deployments (Option E):

**InProcessStrategy workflow resolution** — Event-driven step execution now correctly resolves workflows by their internal ID instead of the config key, fixing silent failures when workflow IDs use different casing than registration keys.

**BackgroundTaskManager producer mode** — Added a `mode` option (`'full'` | `'producer'` | `'worker'`) so the API tier can dispatch background tasks and receive completion notifications without competing with dedicated worker processes for task consumption. Mastra automatically selects `'producer'` mode when workers are disabled or filtered.

**Background task execution engine** — Switched the internal `__background-task` workflow from the evented execution engine to the standard in-process engine, so background tasks execute locally on the worker instead of routing through the orchestration pipeline.

**Agent tool registration** — Agent-owned tools are now registered with the BackgroundTaskManager's static executor registry, enabling cross-process workers to resolve background tasks for tools that are only attached to an agent.
