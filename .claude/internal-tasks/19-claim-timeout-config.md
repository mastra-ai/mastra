# Task 19: Configurable Claim Timeout

## Summary

Make claim timeout configurable with sensible defaults for long-running agent work.

## Files to Modify

- `packages/core/src/inbox/types.ts` - Add timeout config
- `packages/core/src/inbox/inbox.ts` - Use timeout in claim
- `packages/core/src/inbox/inbox-storage.ts` - Handle timeout in claim logic

## Changes

### 1. Update Task Interface

```typescript
// packages/core/src/inbox/types.ts

interface Task {
  // ... existing fields

  claimExpiresAt?: Date; // When the claim expires
}
```

### 2. Add Config Options

```typescript
// packages/core/src/inbox/types.ts

interface InboxConfig {
  id: string;

  /**
   * How long a task can be claimed before it's released.
   * Default: 30 minutes (1800000 ms)
   */
  claimTimeout?: number;

  /**
   * How long before a task is considered stale and auto-cancelled.
   * Default: 24 hours
   */
  taskTtl?: number;

  onComplete?: (task: Task, result: unknown) => Promise<void>;
  onError?: (task: Task, error: Error) => Promise<void>;
}

// Defaults
export const DEFAULT_CLAIM_TIMEOUT = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_TASK_TTL = 24 * 60 * 60 * 1000; // 24 hours
```

### 3. Update Claim Logic

```typescript
// packages/core/src/inbox/inbox-storage.ts

abstract class InboxStorage extends StorageDomain {
  abstract claimTask(params: {
    inboxId: string;
    agentId: string;
    filter?: ClaimFilter;
    claimTimeout?: number; // How long until claim expires
  }): Promise<Task | null>;

  /**
   * Release tasks where claim has expired.
   * Should be called periodically (e.g., every minute).
   */
  abstract releaseExpiredClaims(): Promise<number>;
}
```

### 4. In-Memory Implementation

```typescript
// InMemoryInboxStorage

async claimTask(params: {
  inboxId: string;
  agentId: string;
  filter?: ClaimFilter;
  claimTimeout?: number;
}): Promise<Task | null> {
  const timeout = params.claimTimeout ?? DEFAULT_CLAIM_TIMEOUT;
  const now = new Date();

  // Find task to claim
  const task = this.findClaimableTask(params);
  if (!task) return null;

  // Update task
  task.status = TaskStatus.CLAIMED;
  task.claimedBy = params.agentId;
  task.claimedAt = now;
  task.claimExpiresAt = new Date(now.getTime() + timeout);
  task.updatedAt = now;

  return task;
}

async releaseExpiredClaims(): Promise<number> {
  const now = new Date();
  let released = 0;

  for (const task of this.tasks.values()) {
    if (
      task.status === TaskStatus.CLAIMED &&
      task.claimExpiresAt &&
      task.claimExpiresAt < now
    ) {
      task.status = TaskStatus.PENDING;
      task.claimedBy = undefined;
      task.claimedAt = undefined;
      task.claimExpiresAt = undefined;
      task.updatedAt = now;
      released++;
    }
  }

  return released;
}
```

### 5. Periodic Cleanup (Optional)

```typescript
// In agent.run() or as separate process

// Release expired claims every minute
const cleanupInterval = setInterval(async () => {
  const released = await storage.releaseExpiredClaims();
  if (released > 0) {
    logger.info(`Released ${released} expired claims`);
  }
}, 60_000);
```

## Usage

```typescript
const inbox = new Inbox({
  id: 'tasks',
  claimTimeout: 60 * 60 * 1000, // 1 hour for long-running tasks
});

// Or per-claim
await inbox.claim(agentId, {
  claimTimeout: 2 * 60 * 60 * 1000, // 2 hours for this specific claim
});
```

## Acceptance Criteria

- [ ] Task has claimExpiresAt field
- [ ] InboxConfig has claimTimeout option
- [ ] DEFAULT_CLAIM_TIMEOUT is 30 minutes
- [ ] claimTask sets claimExpiresAt
- [ ] releaseExpiredClaims() releases stale claims
- [ ] Per-claim timeout override works
