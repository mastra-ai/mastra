# Task 14: Inbox Class Unit Tests

## Summary

Unit tests for the Inbox class.

## File to Create

`packages/core/src/inbox/__tests__/inbox.test.ts`

## Test Cases

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Inbox } from '../inbox';
import { InMemoryInboxStorage } from '../inbox-storage';
import { TaskStatus, TaskPriority } from '../types';

describe('Inbox', () => {
  let inbox: Inbox;
  let mockStorage: InMemoryInboxStorage;
  let mockMastra: any;

  beforeEach(() => {
    mockStorage = new InMemoryInboxStorage();
    mockMastra = {
      getStorage: () => ({
        stores: {
          inbox: mockStorage,
        },
      }),
    };

    inbox = new Inbox({ id: 'test-inbox' });
    inbox.__registerMastra(mockMastra);
  });

  describe('constructor', () => {
    it('sets id', () => {
      const inbox = new Inbox({ id: 'my-inbox' });
      expect(inbox.id).toBe('my-inbox');
    });

    it('stores hooks', () => {
      const onComplete = vi.fn();
      const onError = vi.fn();

      const inbox = new Inbox({
        id: 'my-inbox',
        onComplete,
        onError,
      });

      expect(inbox.onComplete).toBe(onComplete);
      expect(inbox.onError).toBe(onError);
    });
  });

  describe('add', () => {
    it('creates task in storage with inboxId', async () => {
      const task = await inbox.add({
        type: 'test',
        payload: { data: 'value' },
      });

      expect(task.inboxId).toBe('test-inbox');
      expect(task.type).toBe('test');
      expect(task.payload).toEqual({ data: 'value' });
    });
  });

  describe('addBatch', () => {
    it('creates multiple tasks', async () => {
      const tasks = await inbox.addBatch([
        { type: 'a', payload: {} },
        { type: 'b', payload: {} },
      ]);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].type).toBe('a');
      expect(tasks[1].type).toBe('b');
    });
  });

  describe('claim', () => {
    it('delegates to storage with inboxId and agentId', async () => {
      await inbox.add({ type: 'test', payload: {} });

      const task = await inbox.claim('agent-1');

      expect(task).not.toBeNull();
      expect(task!.claimedBy).toBe('agent-1');
    });

    it('passes filter to storage', async () => {
      await inbox.add({ type: 'a', payload: {} });
      await inbox.add({ type: 'b', payload: {} });

      const task = await inbox.claim('agent-1', { types: ['b'] });

      expect(task!.type).toBe('b');
    });
  });

  describe('complete', () => {
    it('delegates to storage', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });
      await inbox.claim('agent-1');
      await mockStorage.startTask(task.id);

      await inbox.complete(task.id, { result: 'done' });

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.COMPLETED);
      expect(updated!.result).toEqual({ result: 'done' });
    });
  });

  describe('fail', () => {
    it('delegates to storage with serialized error', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });
      await inbox.claim('agent-1');
      await mockStorage.startTask(task.id);

      await inbox.fail(task.id, new Error('Something failed'));

      const updated = await inbox.get(task.id);
      expect(updated!.error?.message).toBe('Something failed');
    });
  });

  describe('release', () => {
    it('delegates to storage', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });
      await inbox.claim('agent-1');

      await inbox.release(task.id);

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.PENDING);
    });
  });

  describe('cancel', () => {
    it('delegates to storage', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });

      await inbox.cancel(task.id);

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.CANCELLED);
    });
  });

  describe('get', () => {
    it('returns task by id', async () => {
      const created = await inbox.add({ type: 'test', payload: { x: 1 } });

      const task = await inbox.get(created.id);

      expect(task).not.toBeNull();
      expect(task!.payload).toEqual({ x: 1 });
    });

    it('returns null if not found', async () => {
      const task = await inbox.get('nonexistent');
      expect(task).toBeNull();
    });
  });

  describe('list', () => {
    it('returns tasks for this inbox', async () => {
      await inbox.add({ type: 'a', payload: {} });
      await inbox.add({ type: 'b', payload: {} });

      const tasks = await inbox.list();

      expect(tasks).toHaveLength(2);
    });

    it('applies filters', async () => {
      await inbox.add({ type: 'a', payload: {} });
      await inbox.add({ type: 'b', payload: {} });

      const tasks = await inbox.list({ type: 'a' });

      expect(tasks).toHaveLength(1);
    });
  });

  describe('stats', () => {
    it('returns counts for this inbox', async () => {
      await inbox.add({ type: 'a', payload: {} });
      await inbox.add({ type: 'b', payload: {} });
      await inbox.claim('agent-1');

      const stats = await inbox.stats();

      expect(stats.pending).toBe(1);
      expect(stats.claimed).toBe(1);
    });
  });

  describe('dependency injection', () => {
    it('throws if storage not configured', async () => {
      const inbox = new Inbox({ id: 'no-storage' });

      await expect(inbox.add({ type: 'test', payload: {} })).rejects.toThrow('Inbox storage not configured');
    });

    it('throws if mastra has no inbox storage', async () => {
      const inbox = new Inbox({ id: 'test' });
      inbox.__registerMastra({
        getStorage: () => ({ stores: {} }),
      });

      await expect(inbox.add({ type: 'test', payload: {} })).rejects.toThrow('Inbox storage not configured');
    });
  });
});
```

## Acceptance Criteria

- [ ] All Inbox public methods tested
- [ ] Dependency injection tested (storage not configured)
- [ ] Hooks stored correctly
- [ ] Tests pass
