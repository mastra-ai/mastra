# Task 09: Add AgentRunOptions Type

## Summary

Add the AgentRunOptions type for the agent.run() method.

## File to Modify

`packages/core/src/agent/types.ts`

## Types to Add

```typescript
import type { Inbox, Task, ClaimFilter } from '../inbox';

/**
 * Options for agent.run() - the inbox processing loop.
 */
export interface AgentRunOptions {
  /**
   * Inbox or inboxes to process tasks from.
   */
  inbox: Inbox | Inbox[];

  /**
   * Polling interval in milliseconds.
   * @default 1000
   */
  pollInterval?: number;

  /**
   * Maximum concurrent tasks to process.
   * @default 1
   */
  maxConcurrent?: number;

  /**
   * Only claim tasks of these types.
   */
  taskTypes?: string[];

  /**
   * Custom filter function for claiming tasks.
   */
  filter?: (task: Task) => boolean;

  /**
   * Called when a task is claimed and about to be processed.
   */
  onTaskStart?: (task: Task) => void;

  /**
   * Called when a task completes successfully.
   */
  onTaskComplete?: (task: Task, result: unknown) => void;

  /**
   * Called when a task fails.
   */
  onTaskError?: (task: Task, error: Error) => void;

  /**
   * Called when no tasks are available in any inbox.
   */
  onEmpty?: () => void;

  /**
   * AbortSignal to stop the run loop.
   */
  signal?: AbortSignal;
}

/**
 * Options for processing a single task.
 */
export interface ProcessTaskOptions {
  /**
   * Custom handler for the task. If not provided, uses agent.generate().
   */
  handler?: (task: Task, agent: Agent) => Promise<unknown>;
}
```

## Acceptance Criteria

- [ ] AgentRunOptions type defined with all options
- [ ] ProcessTaskOptions type defined
- [ ] Types properly imported from inbox module
- [ ] File passes typecheck
