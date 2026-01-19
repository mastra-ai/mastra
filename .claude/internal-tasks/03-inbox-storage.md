# Task 03: Create InboxStorage Domain

## Summary

Create the InboxStorage domain class that handles persistence of tasks to storage.

## File to Create

`packages/core/src/inbox/inbox-storage.ts`

## Class to Implement

```typescript
import { StorageDomain } from '../storage/domains/base';
import type { Task, CreateTaskInput, ClaimFilter, ListFilter, InboxStats, TaskStatus } from './types';

export abstract class InboxStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'INBOX',
    });
  }

  // Task CRUD
  abstract createTask<TPayload = unknown>(inboxId: string, input: CreateTaskInput<TPayload>): Promise<Task<TPayload>>;

  abstract getTaskById(taskId: string): Promise<Task | null>;

  abstract updateTask(taskId: string, updates: Partial<Task>): Promise<Task>;

  abstract deleteTask(taskId: string): Promise<void>;

  // Claiming
  abstract claimTask(params: { inboxId: string; agentId: string; filter?: ClaimFilter }): Promise<Task | null>;

  abstract releaseTask(taskId: string): Promise<Task>;

  // Status updates
  abstract startTask(taskId: string): Promise<Task>;

  abstract completeTask(taskId: string, result: unknown): Promise<Task>;

  abstract failTask(taskId: string, error: { message: string; stack?: string }): Promise<Task>;

  abstract cancelTask(taskId: string): Promise<Task>;

  // Query
  abstract listTasks(inboxId: string, filter?: ListFilter): Promise<Task[]>;

  abstract getStats(inboxId: string): Promise<InboxStats>;

  abstract getStatsByInbox(): Promise<Record<string, InboxStats>>;

  // Batch operations
  abstract createTasks<TPayload = unknown>(
    inboxId: string,
    inputs: CreateTaskInput<TPayload>[],
  ): Promise<Task<TPayload>[]>;

  abstract deleteTasks(params: { inboxId?: string; status?: TaskStatus[]; olderThan?: Date }): Promise<number>;

  // Upsert (for sync)
  abstract upsertTask<TPayload = unknown>(
    inboxId: string,
    sourceId: string,
    input: CreateTaskInput<TPayload>,
  ): Promise<Task<TPayload>>;
}
```

## In-Memory Implementation

Also create `InMemoryInboxStorage` class in same file or separate:

```typescript
export class InMemoryInboxStorage extends InboxStorage {
  private tasks: Map<string, Task> = new Map();
  private tasksByInbox: Map<string, Set<string>> = new Map();
  private tasksByStatus: Map<TaskStatus, Set<string>> = new Map();

  // Implement all abstract methods...
}
```

## Key Implementation Details

### claimTask Logic

1. Find tasks matching: inboxId, status=pending, filter criteria
2. Order by priority DESC, createdAt ASC
3. If targetAgentId is set, only match if agentId matches
4. Atomically update status to 'claimed', set claimedBy, claimedAt
5. Return claimed task or null

### Upsert Logic (for sync)

1. Look up task by (inboxId, sourceId)
2. If exists and not completed/cancelled, update fields
3. If not exists, create new task
4. Return task

## Reference Files

- `packages/core/src/storage/domains/base.ts` - StorageDomain base class
- `packages/core/src/storage/domains/memory/base.ts` - MemoryStorage pattern
- `packages/core/src/storage/domains/agents/base.ts` - Another domain example

## Acceptance Criteria

- [ ] InboxStorage abstract class defined with all methods
- [ ] InMemoryInboxStorage implements all methods
- [ ] Claim logic handles priority ordering and targetAgentId
- [ ] Upsert logic is idempotent by sourceId
- [ ] All status transitions update appropriate timestamps
- [ ] File passes typecheck
