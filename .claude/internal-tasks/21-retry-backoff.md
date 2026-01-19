# Task 21: Exponential Retry Backoff

## Summary

Implement exponential backoff for task retries.

## Files to Modify

- `packages/core/src/inbox/types.ts` - Add retry config and nextRetryAt
- `packages/core/src/inbox/inbox-storage.ts` - Calculate next retry time
- `packages/core/src/inbox/constants.ts` - Default retry settings

## Changes

### 1. Add Retry Fields to Task

```typescript
// packages/core/src/inbox/types.ts

interface Task {
  // ... existing fields

  // Retries (existing)
  attempts: number;
  maxAttempts: number;

  // Backoff (new)
  nextRetryAt?: Date; // When task can be retried
  lastError?: {
    message: string;
    stack?: string;
    retryable: boolean;
  };
}
```

### 2. Add Retry Config

```typescript
// packages/core/src/inbox/types.ts

interface RetryConfig {
  /**
   * Maximum retry attempts.
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Base delay in ms for exponential backoff.
   * @default 1000 (1 second)
   */
  baseDelay?: number;

  /**
   * Maximum delay in ms (cap for exponential growth).
   * @default 3600000 (1 hour)
   */
  maxDelay?: number;

  /**
   * Multiplier for exponential backoff.
   * @default 2
   */
  multiplier?: number;

  /**
   * Add random jitter to prevent thundering herd.
   * @default true
   */
  jitter?: boolean;
}

interface InboxConfig {
  id: string;
  retry?: RetryConfig;
  // ... other config
}
```

### 3. Add Constants

```typescript
// packages/core/src/inbox/constants.ts

export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 3600000, // 1 hour
  multiplier: 2,
  jitter: true,
};

// Example backoff progression (with multiplier=2):
// Attempt 1 fail → wait 1s
// Attempt 2 fail → wait 2s
// Attempt 3 fail → wait 4s
// Attempt 4 fail → wait 8s
// ... capped at maxDelay
```

### 4. Backoff Calculation Utility

```typescript
// packages/core/src/inbox/utils.ts

export function calculateBackoff(attempt: number, config: Required<RetryConfig>): number {
  const { baseDelay, maxDelay, multiplier, jitter } = config;

  // Exponential: baseDelay * (multiplier ^ attempt)
  let delay = baseDelay * Math.pow(multiplier, attempt - 1);

  // Cap at maxDelay
  delay = Math.min(delay, maxDelay);

  // Add jitter (±25%)
  if (jitter) {
    const jitterRange = delay * 0.25;
    delay += (Math.random() * 2 - 1) * jitterRange;
  }

  return Math.floor(delay);
}

// Examples:
// attempt 1: 1000ms (1s)
// attempt 2: 2000ms (2s)
// attempt 3: 4000ms (4s)
// attempt 4: 8000ms (8s)
// attempt 5: 16000ms (16s)
// ...
// capped at 3600000ms (1 hour)
```

### 5. Update failTask in Storage

```typescript
// packages/core/src/inbox/inbox-storage.ts

async failTask(
  taskId: string,
  error: { message: string; stack?: string; retryable?: boolean },
  retryConfig: Required<RetryConfig>
): Promise<Task> {
  const task = this.tasks.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const now = new Date();
  const newAttempts = task.attempts + 1;
  const shouldRetry =
    error.retryable !== false &&
    newAttempts < retryConfig.maxAttempts;

  if (shouldRetry) {
    // Calculate next retry time
    const backoffMs = calculateBackoff(newAttempts, retryConfig);
    const nextRetryAt = new Date(now.getTime() + backoffMs);

    task.status = TaskStatus.PENDING;
    task.attempts = newAttempts;
    task.nextRetryAt = nextRetryAt;
    task.lastError = { ...error, retryable: true };
    task.claimedBy = undefined;
    task.claimedAt = undefined;
    task.updatedAt = now;

    this.logger.info('Task scheduled for retry', {
      taskId,
      attempt: newAttempts,
      nextRetryAt,
      backoffMs,
    });
  } else {
    // Max attempts reached or non-retryable error
    task.status = TaskStatus.FAILED;
    task.attempts = newAttempts;
    task.completedAt = now;
    task.lastError = { ...error, retryable: false };
    task.updatedAt = now;

    this.logger.info('Task failed permanently', {
      taskId,
      attempts: newAttempts,
      reason: newAttempts >= retryConfig.maxAttempts
        ? 'max_attempts_reached'
        : 'non_retryable_error',
    });
  }

  return task;
}
```

### 6. Update Claim Logic

```typescript
// packages/core/src/inbox/inbox-storage.ts

async claimTask(params: ClaimParams): Promise<Task | null> {
  const now = new Date();

  // Find claimable task
  for (const task of this.getTasksByPriority(params.inboxId)) {
    if (task.status !== TaskStatus.PENDING) continue;

    // Skip if not yet ready for retry
    if (task.nextRetryAt && task.nextRetryAt > now) continue;

    // ... rest of claim logic
  }
}
```

### 7. Error Classification

```typescript
// packages/core/src/inbox/errors.ts

export function isRetryableError(error: Error): boolean {
  // Network errors
  if (error.message.includes('ECONNRESET')) return true;
  if (error.message.includes('ETIMEDOUT')) return true;
  if (error.message.includes('fetch failed')) return true;

  // Rate limits
  if (error.message.includes('rate limit')) return true;
  if (error.message.includes('429')) return true;

  // Temporary failures
  if (error.message.includes('503')) return true;
  if (error.message.includes('502')) return true;

  // Non-retryable by default
  return false;
}
```

## Usage

```typescript
const inbox = new Inbox({
  id: 'tasks',
  retry: {
    maxAttempts: 5,
    baseDelay: 5000, // Start at 5s
    maxDelay: 1800000, // Cap at 30 mins
    multiplier: 2,
    jitter: true,
  },
});

// Or use defaults
const inbox = new Inbox({ id: 'tasks' });
// maxAttempts: 3, baseDelay: 1s, maxDelay: 1h
```

## Acceptance Criteria

- [ ] Task has nextRetryAt field
- [ ] RetryConfig with maxAttempts, baseDelay, maxDelay, multiplier, jitter
- [ ] calculateBackoff() implements exponential backoff
- [ ] failTask() schedules retry with backoff
- [ ] claimTask() respects nextRetryAt
- [ ] Non-retryable errors skip retry
- [ ] Jitter prevents thundering herd
- [ ] Backoff capped at maxDelay
