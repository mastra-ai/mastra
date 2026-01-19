# Task 04: Create Base Inbox Class

## Summary

Create the main Inbox class that users instantiate and use.

## File to Create

`packages/core/src/inbox/inbox.ts`

## Class to Implement

```typescript
import { MastraBase } from '../base';
import type { IInbox, Task, CreateTaskInput, ClaimFilter, ListFilter, InboxStats, InboxConfig } from './types';
import type { InboxStorage } from './inbox-storage';
import type { Mastra } from '../mastra';

export class Inbox<TTask extends Task = Task> extends MastraBase implements IInbox<TTask> {
  readonly id: string;

  #storage?: InboxStorage;
  #mastra?: Mastra;

  onComplete?: (task: TTask, result: unknown) => Promise<void>;
  onError?: (task: TTask, error: Error) => Promise<void>;

  constructor(config: InboxConfig) {
    super({
      component: 'INBOX',
      name: config.id,
    });

    this.id = config.id;
    this.onComplete = config.onComplete;
    this.onError = config.onError;
  }

  // Called by Mastra to inject dependencies
  __registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }

  // Get storage from Mastra
  private getStorage(): InboxStorage {
    if (this.#storage) return this.#storage;

    const storage = this.#mastra?.getStorage();
    const inboxStorage = storage?.stores?.inbox;

    if (!inboxStorage) {
      throw new Error('Inbox storage not configured');
    }

    this.#storage = inboxStorage;
    return inboxStorage;
  }

  // Producer API
  async add(input: CreateTaskInput): Promise<TTask> {
    const storage = this.getStorage();
    return storage.createTask(this.id, input) as Promise<TTask>;
  }

  async addBatch(inputs: CreateTaskInput[]): Promise<TTask[]> {
    const storage = this.getStorage();
    return storage.createTasks(this.id, inputs) as Promise<TTask[]>;
  }

  // Consumer API
  async claim(agentId: string, filter?: ClaimFilter): Promise<TTask | null> {
    const storage = this.getStorage();
    return storage.claimTask({
      inboxId: this.id,
      agentId,
      filter,
    }) as Promise<TTask | null>;
  }

  async complete(taskId: string, result: unknown): Promise<void> {
    const storage = this.getStorage();
    await storage.completeTask(taskId, result);
  }

  async fail(taskId: string, error: Error): Promise<void> {
    const storage = this.getStorage();
    await storage.failTask(taskId, {
      message: error.message,
      stack: error.stack,
    });
  }

  async release(taskId: string): Promise<void> {
    const storage = this.getStorage();
    await storage.releaseTask(taskId);
  }

  async cancel(taskId: string): Promise<void> {
    const storage = this.getStorage();
    await storage.cancelTask(taskId);
  }

  // Query API
  async get(taskId: string): Promise<TTask | null> {
    const storage = this.getStorage();
    return storage.getTaskById(taskId) as Promise<TTask | null>;
  }

  async list(filter?: ListFilter): Promise<TTask[]> {
    const storage = this.getStorage();
    return storage.listTasks(this.id, filter) as Promise<TTask[]>;
  }

  async stats(): Promise<InboxStats> {
    const storage = this.getStorage();
    return storage.getStats(this.id);
  }
}
```

## Key Implementation Details

### Dependency Injection

- Inbox receives Mastra instance via `__registerMastra()` (like Agent)
- Storage is accessed lazily from Mastra

### Hooks

- `onComplete` and `onError` are stored on instance
- Called by Agent after task processing (not by Inbox itself)

### Error Handling

- Throw clear error if storage not configured
- Use proper error types from `../error`

## Reference Files

- `packages/core/src/agent/agent.ts` - How Agent uses \_\_registerMastra
- `packages/core/src/base.ts` - MastraBase class

## Acceptance Criteria

- [ ] Inbox class implements IInbox interface
- [ ] Dependency injection via \_\_registerMastra works
- [ ] All methods delegate to InboxStorage
- [ ] Hooks are configurable via constructor
- [ ] File passes typecheck
