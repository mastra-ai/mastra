# Task 16: Mastra Inbox Integration Tests

## Summary

Unit tests for Mastra inbox configuration and methods.

## File to Create

`packages/core/src/mastra/__tests__/mastra-inbox.test.ts`

## Test Cases

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Mastra } from '../index';
import { Inbox, InMemoryInboxStorage } from '../../inbox';
import { Agent } from '../../agent';

describe('Mastra inbox integration', () => {
  let storage: InMemoryInboxStorage;

  beforeEach(() => {
    storage = new InMemoryInboxStorage();
  });

  describe('configuration', () => {
    it('registers inboxes from config', () => {
      const inbox1 = new Inbox({ id: 'inbox-1' });
      const inbox2 = new Inbox({ id: 'inbox-2' });

      const mastra = new Mastra({
        storage: {
          stores: { inbox: storage },
        } as any,
        inboxes: {
          first: inbox1,
          second: inbox2,
        },
      });

      expect(mastra.listInboxes()).toHaveLength(2);
    });

    it('calls __registerMastra on each inbox', () => {
      const inbox = new Inbox({ id: 'test' });
      let registered = false;
      const originalRegister = inbox.__registerMastra.bind(inbox);
      inbox.__registerMastra = m => {
        registered = true;
        originalRegister(m);
      };

      new Mastra({
        storage: { stores: { inbox: storage } } as any,
        inboxes: { test: inbox },
      });

      expect(registered).toBe(true);
    });
  });

  describe('getInbox', () => {
    it('returns inbox by id', () => {
      const inbox = new Inbox({ id: 'my-inbox' });

      const mastra = new Mastra({
        storage: { stores: { inbox: storage } } as any,
        inboxes: { my: inbox },
      });

      const found = mastra.getInbox('my-inbox');
      expect(found).toBe(inbox);
    });

    it('returns undefined if not found', () => {
      const mastra = new Mastra({
        storage: { stores: { inbox: storage } } as any,
        inboxes: {},
      });

      const found = mastra.getInbox('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('getInboxOrThrow', () => {
    it('returns inbox by id', () => {
      const inbox = new Inbox({ id: 'my-inbox' });

      const mastra = new Mastra({
        storage: { stores: { inbox: storage } } as any,
        inboxes: { my: inbox },
      });

      const found = mastra.getInboxOrThrow('my-inbox');
      expect(found).toBe(inbox);
    });

    it('throws if not found', () => {
      const mastra = new Mastra({
        storage: { stores: { inbox: storage } } as any,
        inboxes: {},
      });

      expect(() => mastra.getInboxOrThrow('nonexistent')).toThrow("Inbox 'nonexistent' not found");
    });
  });

  describe('listInboxes', () => {
    it('returns all registered inboxes', () => {
      const inbox1 = new Inbox({ id: 'a' });
      const inbox2 = new Inbox({ id: 'b' });
      const inbox3 = new Inbox({ id: 'c' });

      const mastra = new Mastra({
        storage: { stores: { inbox: storage } } as any,
        inboxes: { a: inbox1, b: inbox2, c: inbox3 },
      });

      const inboxes = mastra.listInboxes();
      expect(inboxes).toHaveLength(3);
      expect(inboxes.map(i => i.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array if no inboxes', () => {
      const mastra = new Mastra({
        storage: { stores: { inbox: storage } } as any,
      });

      expect(mastra.listInboxes()).toEqual([]);
    });
  });

  describe('addTask', () => {
    it('adds task to specified inbox', async () => {
      const inbox = new Inbox({ id: 'tasks' });

      const mastra = new Mastra({
        storage: { stores: { inbox: storage } } as any,
        inboxes: { tasks: inbox },
      });

      const task = await mastra.addTask('tasks', {
        type: 'test',
        payload: { data: 'value' },
      });

      expect(task.inboxId).toBe('tasks');
      expect(task.type).toBe('test');
      expect(task.payload).toEqual({ data: 'value' });
    });

    it('throws if inbox not found', async () => {
      const mastra = new Mastra({
        storage: { stores: { inbox: storage } } as any,
        inboxes: {},
      });

      await expect(mastra.addTask('nonexistent', { type: 'test', payload: {} })).rejects.toThrow(
        "Inbox 'nonexistent' not found",
      );
    });
  });

  describe('agent integration', () => {
    it('agent can access inboxes via mastra', async () => {
      const inbox = new Inbox({ id: 'work' });
      const agent = new Agent({
        id: 'worker',
        name: 'Worker',
        instructions: 'Process tasks',
        model: { provider: 'openai', name: 'gpt-4' },
      });

      const mastra = new Mastra({
        storage: { stores: { inbox: storage } } as any,
        inboxes: { work: inbox },
        agents: { worker: agent },
      });

      // Add task via mastra
      await mastra.addTask('work', { type: 'test', payload: {} });

      // Verify task is in inbox
      const tasks = await inbox.list();
      expect(tasks).toHaveLength(1);
    });
  });
});
```

## Acceptance Criteria

- [ ] Inbox registration tested
- [ ] \_\_registerMastra called on inboxes
- [ ] getInbox / getInboxOrThrow tested
- [ ] listInboxes tested
- [ ] addTask tested
- [ ] Agent integration tested
- [ ] Tests pass
