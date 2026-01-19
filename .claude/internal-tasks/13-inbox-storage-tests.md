# Task 13: InboxStorage Shared Tests

## Summary

Create shared tests for InboxStorage that can run against any implementation (InMemory, Pg, etc.).

## File to Create

`test-utils/src/storage/inbox-storage.test.ts`

## Reference

Look at existing shared storage tests in test-utils to follow the pattern:

- `test-utils/src/storage/` - existing storage domain tests

## Test Cases

### createTask

```typescript
describe('createTask', () => {
  it('creates task with all fields', async () => {
    const task = await storage.createTask('inbox-1', {
      type: 'test',
      payload: { foo: 'bar' },
      title: 'Test Task',
      priority: TaskPriority.HIGH,
      targetAgentId: 'agent-1',
      maxAttempts: 5,
      metadata: { key: 'value' },
    });

    expect(task.id).toBeDefined();
    expect(task.inboxId).toBe('inbox-1');
    expect(task.type).toBe('test');
    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.payload).toEqual({ foo: 'bar' });
    expect(task.priority).toBe(TaskPriority.HIGH);
    expect(task.createdAt).toBeInstanceOf(Date);
  });

  it('generates id if not provided', async () => {
    const task = await storage.createTask('inbox-1', {
      type: 'test',
      payload: {},
    });
    expect(task.id).toBeDefined();
    expect(typeof task.id).toBe('string');
  });

  it('sets default priority and maxAttempts', async () => {
    const task = await storage.createTask('inbox-1', {
      type: 'test',
      payload: {},
    });
    expect(task.priority).toBe(TaskPriority.NORMAL);
    expect(task.maxAttempts).toBe(3);
  });
});
```

### claimTask

```typescript
describe('claimTask', () => {
  it('claims pending task', async () => {
    const created = await storage.createTask('inbox-1', { type: 'test', payload: {} });

    const claimed = await storage.claimTask({
      inboxId: 'inbox-1',
      agentId: 'agent-1',
    });

    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(created.id);
    expect(claimed!.status).toBe(TaskStatus.CLAIMED);
    expect(claimed!.claimedBy).toBe('agent-1');
    expect(claimed!.claimedAt).toBeInstanceOf(Date);
  });

  it('returns null if no pending tasks', async () => {
    const claimed = await storage.claimTask({
      inboxId: 'inbox-1',
      agentId: 'agent-1',
    });
    expect(claimed).toBeNull();
  });

  it('respects targetAgentId - only matching agent can claim', async () => {
    await storage.createTask('inbox-1', {
      type: 'test',
      payload: {},
      targetAgentId: 'agent-1',
    });

    // Wrong agent
    const claimed1 = await storage.claimTask({
      inboxId: 'inbox-1',
      agentId: 'agent-2',
    });
    expect(claimed1).toBeNull();

    // Right agent
    const claimed2 = await storage.claimTask({
      inboxId: 'inbox-1',
      agentId: 'agent-1',
    });
    expect(claimed2).not.toBeNull();
  });

  it('respects taskTypes filter', async () => {
    await storage.createTask('inbox-1', { type: 'analyze', payload: {} });
    await storage.createTask('inbox-1', { type: 'review', payload: {} });

    const claimed = await storage.claimTask({
      inboxId: 'inbox-1',
      agentId: 'agent-1',
      filter: { types: ['review'] },
    });

    expect(claimed!.type).toBe('review');
  });

  it('claims highest priority first', async () => {
    await storage.createTask('inbox-1', { type: 'low', payload: {}, priority: TaskPriority.LOW });
    await storage.createTask('inbox-1', { type: 'high', payload: {}, priority: TaskPriority.HIGH });
    await storage.createTask('inbox-1', { type: 'normal', payload: {}, priority: TaskPriority.NORMAL });

    const claimed = await storage.claimTask({
      inboxId: 'inbox-1',
      agentId: 'agent-1',
    });

    expect(claimed!.type).toBe('high');
  });

  it('claims oldest task within same priority (FIFO)', async () => {
    const first = await storage.createTask('inbox-1', { type: 'first', payload: {} });
    await sleep(10);
    await storage.createTask('inbox-1', { type: 'second', payload: {} });

    const claimed = await storage.claimTask({
      inboxId: 'inbox-1',
      agentId: 'agent-1',
    });

    expect(claimed!.id).toBe(first.id);
  });

  it('cannot claim already claimed task', async () => {
    await storage.createTask('inbox-1', { type: 'test', payload: {} });

    const claimed1 = await storage.claimTask({ inboxId: 'inbox-1', agentId: 'agent-1' });
    const claimed2 = await storage.claimTask({ inboxId: 'inbox-1', agentId: 'agent-2' });

    expect(claimed1).not.toBeNull();
    expect(claimed2).toBeNull();
  });
});
```

### completeTask / failTask / releaseTask / cancelTask

```typescript
describe('completeTask', () => {
  it('sets status=completed, result, completedAt', async () => {
    const task = await storage.createTask('inbox-1', { type: 'test', payload: {} });
    await storage.claimTask({ inboxId: 'inbox-1', agentId: 'agent-1' });
    await storage.startTask(task.id);

    const completed = await storage.completeTask(task.id, { output: 'done' });

    expect(completed.status).toBe(TaskStatus.COMPLETED);
    expect(completed.result).toEqual({ output: 'done' });
    expect(completed.completedAt).toBeInstanceOf(Date);
  });
});

describe('failTask', () => {
  it('sets status=failed and error', async () => {
    const task = await storage.createTask('inbox-1', { type: 'test', payload: {} });
    await storage.claimTask({ inboxId: 'inbox-1', agentId: 'agent-1' });
    await storage.startTask(task.id);

    const failed = await storage.failTask(task.id, { message: 'Something went wrong' });

    expect(failed.status).toBe(TaskStatus.FAILED);
    expect(failed.error).toEqual({ message: 'Something went wrong' });
    expect(failed.attempts).toBe(1);
  });

  it('resets to pending if attempts < maxAttempts', async () => {
    const task = await storage.createTask('inbox-1', {
      type: 'test',
      payload: {},
      maxAttempts: 3,
    });
    await storage.claimTask({ inboxId: 'inbox-1', agentId: 'agent-1' });
    await storage.startTask(task.id);

    // First failure - should retry
    const failed1 = await storage.failTask(task.id, { message: 'error' });
    expect(failed1.status).toBe(TaskStatus.PENDING);
    expect(failed1.attempts).toBe(1);

    // Can be claimed again
    const reclaimed = await storage.claimTask({ inboxId: 'inbox-1', agentId: 'agent-1' });
    expect(reclaimed).not.toBeNull();
  });
});

describe('releaseTask', () => {
  it('resets status to pending and clears claim', async () => {
    const task = await storage.createTask('inbox-1', { type: 'test', payload: {} });
    await storage.claimTask({ inboxId: 'inbox-1', agentId: 'agent-1' });

    const released = await storage.releaseTask(task.id);

    expect(released.status).toBe(TaskStatus.PENDING);
    expect(released.claimedBy).toBeUndefined();
    expect(released.claimedAt).toBeUndefined();
  });
});

describe('cancelTask', () => {
  it('sets status=cancelled', async () => {
    const task = await storage.createTask('inbox-1', { type: 'test', payload: {} });

    const cancelled = await storage.cancelTask(task.id);

    expect(cancelled.status).toBe(TaskStatus.CANCELLED);
  });
});
```

### listTasks / stats

```typescript
describe('listTasks', () => {
  it('filters by status', async () => {
    await storage.createTask('inbox-1', { type: 'a', payload: {} });
    const task2 = await storage.createTask('inbox-1', { type: 'b', payload: {} });
    await storage.claimTask({ inboxId: 'inbox-1', agentId: 'agent-1' });

    const pending = await storage.listTasks('inbox-1', { status: TaskStatus.PENDING });
    const claimed = await storage.listTasks('inbox-1', { status: TaskStatus.CLAIMED });

    expect(pending).toHaveLength(1);
    expect(claimed).toHaveLength(1);
  });

  it('filters by type', async () => {
    await storage.createTask('inbox-1', { type: 'analyze', payload: {} });
    await storage.createTask('inbox-1', { type: 'review', payload: {} });

    const tasks = await storage.listTasks('inbox-1', { type: 'analyze' });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('analyze');
  });

  it('pagination works', async () => {
    for (let i = 0; i < 5; i++) {
      await storage.createTask('inbox-1', { type: 'test', payload: { i } });
    }

    const page1 = await storage.listTasks('inbox-1', { limit: 2, offset: 0 });
    const page2 = await storage.listTasks('inbox-1', { limit: 2, offset: 2 });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
  });
});

describe('stats', () => {
  it('returns correct counts by status', async () => {
    await storage.createTask('inbox-1', { type: 'a', payload: {} });
    await storage.createTask('inbox-1', { type: 'b', payload: {} });
    const task3 = await storage.createTask('inbox-1', { type: 'c', payload: {} });

    await storage.claimTask({ inboxId: 'inbox-1', agentId: 'agent-1' });
    await storage.cancelTask(task3.id);

    const stats = await storage.getStats('inbox-1');

    expect(stats.pending).toBe(1);
    expect(stats.claimed).toBe(1);
    expect(stats.cancelled).toBe(1);
  });
});
```

### upsertTask

```typescript
describe('upsertTask', () => {
  it('creates new task if sourceId not found', async () => {
    const task = await storage.upsertTask('inbox-1', 'issue-123', {
      type: 'github',
      payload: { title: 'Fix bug' },
    });

    expect(task.sourceId).toBe('issue-123');
    expect(task.payload).toEqual({ title: 'Fix bug' });
  });

  it('updates existing task if sourceId exists', async () => {
    await storage.upsertTask('inbox-1', 'issue-123', {
      type: 'github',
      payload: { title: 'Fix bug' },
    });

    const updated = await storage.upsertTask('inbox-1', 'issue-123', {
      type: 'github',
      payload: { title: 'Fix bug (updated)' },
    });

    expect(updated.payload).toEqual({ title: 'Fix bug (updated)' });

    // Should still be only one task
    const tasks = await storage.listTasks('inbox-1');
    expect(tasks).toHaveLength(1);
  });

  it('does not update completed tasks', async () => {
    const task = await storage.upsertTask('inbox-1', 'issue-123', {
      type: 'github',
      payload: { title: 'Original' },
    });

    await storage.claimTask({ inboxId: 'inbox-1', agentId: 'agent-1' });
    await storage.startTask(task.id);
    await storage.completeTask(task.id, { done: true });

    // Try to update
    await storage.upsertTask('inbox-1', 'issue-123', {
      type: 'github',
      payload: { title: 'Updated' },
    });

    // Should not change
    const fetched = await storage.getTaskById(task.id);
    expect(fetched!.payload).toEqual({ title: 'Original' });
  });
});
```

## Export Pattern

Follow test-utils pattern for exporting shared tests that can be run against different implementations.

## Acceptance Criteria

- [ ] Tests follow existing test-utils patterns
- [ ] All InboxStorage methods have test coverage
- [ ] Tests can run against any InboxStorage implementation
- [ ] Tests pass with InMemoryInboxStorage
