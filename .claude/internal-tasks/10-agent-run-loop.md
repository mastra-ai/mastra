# Task 10: Add Agent Run Loop

## Summary

Add run(), stop(), and processTask() methods to the Agent class.

## File to Modify

`packages/core/src/agent/agent.ts`

## Changes Required

### 1. Add Private Fields

```typescript
class Agent {
  // ... existing fields ...

  #runLoopActive = false;
  #runLoopAbortController?: AbortController;
}
```

### 2. Add run() Method

```typescript
/**
 * Start the inbox processing loop.
 * Agent will continuously poll inboxes and process tasks.
 */
async run(options: AgentRunOptions): Promise<void> {
  if (this.#runLoopActive) {
    this.logger.warn('Run loop already active');
    return;
  }

  const inboxes = Array.isArray(options.inbox) ? options.inbox : [options.inbox];
  const pollInterval = options.pollInterval ?? 1000;
  const maxConcurrent = options.maxConcurrent ?? 1;

  this.#runLoopActive = true;
  this.#runLoopAbortController = new AbortController();

  const signal = options.signal ?? this.#runLoopAbortController.signal;
  let activeTasks = 0;

  const claimFilter: ClaimFilter = {
    types: options.taskTypes,
    filter: options.filter,
  };

  try {
    while (!signal.aborted && this.#runLoopActive) {
      // Skip if at capacity
      if (activeTasks >= maxConcurrent) {
        await this.#sleep(pollInterval, signal);
        continue;
      }

      let claimedTask = false;

      // Try each inbox
      for (const inbox of inboxes) {
        if (activeTasks >= maxConcurrent) break;
        if (signal.aborted || !this.#runLoopActive) break;

        const task = await inbox.claim(this.id, claimFilter);

        if (task) {
          claimedTask = true;
          activeTasks++;

          // Process task (don't await - allow concurrency)
          this.#processTask(task, inbox, options)
            .finally(() => {
              activeTasks--;
            });
        }
      }

      if (!claimedTask) {
        options.onEmpty?.();
      }

      await this.#sleep(pollInterval, signal);
    }
  } finally {
    this.#runLoopActive = false;
  }
}
```

### 3. Add stop() Method

```typescript
/**
 * Stop the inbox processing loop.
 */
stop(): void {
  this.#runLoopActive = false;
  this.#runLoopAbortController?.abort();
}
```

### 4. Add processTask() Method

```typescript
/**
 * Process a single task.
 */
async #processTask(
  task: Task,
  inbox: Inbox,
  options: AgentRunOptions
): Promise<void> {
  options.onTaskStart?.(task);

  try {
    // Mark as in progress
    await inbox.getStorage().startTask(task.id);

    // Generate response using agent
    const result = await this.generate({
      messages: [
        {
          role: 'user',
          content: typeof task.payload === 'string'
            ? task.payload
            : JSON.stringify(task.payload),
        },
      ],
      threadId: task.metadata?.threadId as string | undefined,
      resourceId: task.metadata?.resourceId as string | undefined,
    });

    const output = { text: result.text, usage: result.usage };

    // Complete task
    await inbox.complete(task.id, output);

    // Run inbox hook
    await inbox.onComplete?.(task, output);

    // Run callback
    options.onTaskComplete?.(task, output);

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Fail task
    await inbox.fail(task.id, err);

    // Run inbox hook
    await inbox.onError?.(task, err);

    // Run callback
    options.onTaskError?.(task, err);
  }
}
```

### 5. Add sleep Helper

```typescript
async #sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      resolve(); // Don't reject, just stop waiting
    });
  });
}
```

### 6. Add Imports

```typescript
import type { AgentRunOptions } from './types';
import type { Inbox, Task, ClaimFilter } from '../inbox';
```

## Key Implementation Details

### Concurrency

- Track `activeTasks` count
- Don't await processTask - let it run concurrently
- Decrement count in finally block

### Graceful Shutdown

- Check signal.aborted and this.#runLoopActive in loop
- Sleep resolves (not rejects) on abort for clean exit

### Error Isolation

- Each task's errors are caught individually
- One failing task doesn't stop the loop

## Acceptance Criteria

- [ ] run() starts polling loop
- [ ] stop() stops the loop gracefully
- [ ] Concurrency limit respected
- [ ] AbortSignal support works
- [ ] Callbacks called at right times
- [ ] Inbox hooks called after task complete/fail
- [ ] File passes typecheck
