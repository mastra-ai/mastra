---
'@mastra/server': minor
---

Added HTTP endpoints for managing agent rollouts and experiments (`/agents/:agentId/rollout` — start, update weight, promote, rollback, cancel, get status, query results, list history). Generate and stream endpoints now automatically resolve agent versions from active rollouts when no explicit version is requested.
