---
'@mastra/core': minor
---

Added agent rollout and experimentation support — canary rollouts and A/B experiments for agents.

### What this enables

- **Canary rollouts**: Gradually shift traffic from a stable agent version to a candidate. Auto-rollback monitors scorer results and reverts if scores drop below a threshold.
- **A/B experiments**: Split traffic across multiple agent versions with fixed weights to compare performance.
- **Sticky routing**: Deterministic hash-based version assignment (`hash(resourceId + agentId) % 100`) so the same user always gets the same version during a rollout — no version flip-flopping mid-conversation.

### New storage domain: `mastra_rollouts`

New table schema for tracking rollout lifecycle and configuration:

```
ROLLOUTS_SCHEMA:
  id           text     (primary key)
  agentId      text
  type         text     ('canary' | 'ab_test')
  status       text     ('active' | 'completed' | 'rolled_back' | 'cancelled')
  stableVersionId  text
  allocations  jsonb    (array of { versionId, weight, label? })
  routingKey   text?    (request context field for sticky routing, default: 'resourceId')
  rules        jsonb?   (auto-rollback rules: { scorerId, threshold, windowSize, action })
  createdAt    timestamp
  updatedAt    timestamp
  completedAt  timestamp?
```

### New types

```ts
type RolloutType = 'canary' | 'ab_test';
type RolloutStatus = 'active' | 'completed' | 'rolled_back' | 'cancelled';

interface RolloutAllocation {
  versionId: string;
  weight: number;    // 0-100
  label?: string;    // e.g. "stable", "candidate"
}

interface RolloutRule {
  scorerId: string;
  threshold: number;   // minimum acceptable avg score (0-1)
  windowSize: number;  // number of recent scores to evaluate
  action: 'rollback';
}

interface RolloutRecord {
  id: string;
  agentId: string;
  type: RolloutType;
  status: RolloutStatus;
  stableVersionId: string;
  allocations: RolloutAllocation[];
  routingKey?: string;
  rules?: RolloutRule[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}
```

### Auto-rollback accumulator

The `RolloutAccumulator` is an in-memory sliding window that collects scorer results during active rollouts. A background loop (default: every 30s) checks rollout rules against accumulated scores. If a candidate version's average score drops below the configured threshold over the specified window, the rollout is automatically rolled back.

- O(1) push per score — no overhead on the hot path
- Circular buffer (max 1000 entries per agent/version/scorer combination)
- Each server instance has its own accumulator (no shared state needed)
- On server restart, windows reset — safe because "no data" means "keep running"

### Core functions

```ts
// Deterministically resolve which version a request should use
resolveVersionFromRollout(rollout: RolloutRecord, requestContext?: { get(key: string): unknown }): string

// Check rollout rules against accumulated scores, returns first breached rule or null
evaluateRules(rollout: RolloutRecord, accumulator: RolloutAccumulator): RolloutRule | null
```
