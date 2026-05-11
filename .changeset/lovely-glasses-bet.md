---
'@mastra/server': minor
---

Added HTTP endpoints for managing agent rollouts and experiments (`/agents/:agentId/rollout` — start, update weight, promote, rollback, cancel, get status, query results, list history). Allocation weights are fractional values in `[0, 1]` (e.g. `0.05` for 5%) that must sum to 1 per rollout. Generate and stream endpoints now automatically resolve agent versions from active rollouts when no explicit version is requested.
