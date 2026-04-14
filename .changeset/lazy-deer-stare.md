---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
---

Added `mastra_rollouts` storage domain implementation for LibSQL, PostgreSQL, and MongoDB.

Each adapter supports the full rollout lifecycle:
- `createRollout` — insert a new rollout record with allocations and rules
- `getActiveRollout` — fetch the currently active rollout for an agent (filtered by `status = 'active'`)
- `getRollout` — fetch a rollout by ID
- `updateRollout` — update allocations and rules for an in-progress rollout
- `completeRollout` — mark a rollout as completed, rolled back, or cancelled
- `listRollouts` — paginated listing of rollouts for an agent, ordered by `createdAt` descending

Indexes are created on `agentId` and `status` for efficient lookups.
