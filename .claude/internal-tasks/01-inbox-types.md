# Task 01: Create Inbox Types

## Summary

Create the core type definitions for the Agent Inbox system.

## File to Create

`packages/core/src/inbox/types.ts`

## Types to Define

### TaskStatus

```typescript
export const TaskStatus = {
  PENDING: 'pending',
  CLAIMED: 'claimed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
```

### TaskPriority

```typescript
export const TaskPriority = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];
```

### Task Interface

```typescript
export interface Task<TPayload = unknown, TResult = unknown> {
  id: string;
  inboxId: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;

  // Display
  title?: string;
  sourceId?: string;
  sourceUrl?: string;

  // Data
  payload: TPayload;
  result?: TResult;
  error?: { message: string; stack?: string };

  // Assignment
  targetAgentId?: string;
  claimedBy?: string;

  // Timing
  createdAt: Date;
  claimedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Retries
  attempts: number;
  maxAttempts: number;

  // Metadata
  metadata?: Record<string, unknown>;
}
```

### CreateTaskInput

```typescript
export interface CreateTaskInput<TPayload = unknown> {
  id?: string;
  type: string;
  payload: TPayload;
  priority?: TaskPriority;
  title?: string;
  targetAgentId?: string;
  sourceId?: string;
  sourceUrl?: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}
```

### ClaimFilter

```typescript
export interface ClaimFilter {
  types?: string[];
  filter?: (task: Task) => boolean;
}
```

### ListFilter

```typescript
export interface ListFilter {
  status?: TaskStatus | TaskStatus[];
  type?: string | string[];
  inboxId?: string;
  targetAgentId?: string;
  claimedBy?: string;
  priority?: TaskPriority;
  limit?: number;
  offset?: number;
}
```

### InboxStats

```typescript
export interface InboxStats {
  pending: number;
  claimed: number;
  inProgress: number;
  completed: number;
  failed: number;
}
```

### Inbox Interface

```typescript
export interface IInbox<TTask extends Task = Task> {
  id: string;

  // Sync (optional, for external sources)
  sync?(): Promise<void>;
  startSync?(): void;
  stopSync?(): void;

  // Producer API
  add(input: CreateTaskInput): Promise<TTask>;
  addBatch(inputs: CreateTaskInput[]): Promise<TTask[]>;

  // Consumer API
  claim(agentId: string, filter?: ClaimFilter): Promise<TTask | null>;
  complete(taskId: string, result: unknown): Promise<void>;
  fail(taskId: string, error: Error): Promise<void>;
  release(taskId: string): Promise<void>;
  cancel(taskId: string): Promise<void>;

  // Query API
  get(taskId: string): Promise<TTask | null>;
  list(filter?: ListFilter): Promise<TTask[]>;
  stats(): Promise<InboxStats>;

  // Hooks
  onComplete?: (task: TTask, result: unknown) => Promise<void>;
  onError?: (task: TTask, error: Error) => Promise<void>;
}
```

### InboxConfig

```typescript
export interface InboxConfig {
  id: string;
  onComplete?: (task: Task, result: unknown) => Promise<void>;
  onError?: (task: Task, error: Error) => Promise<void>;
}
```

## Acceptance Criteria

- [ ] All types are exported
- [ ] Types use proper generics for payload/result typing
- [ ] TaskStatus and TaskPriority are const objects with derived types
- [ ] File passes typecheck
