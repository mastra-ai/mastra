# Task 15: Agent Run Loop Tests

## Summary

Unit tests for the Agent.run(), stop(), and task processing methods.

## File to Create

`packages/core/src/agent/__tests__/agent-run.test.ts`

## Test Cases

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Agent } from '../agent';
import { Inbox, InMemoryInboxStorage, TaskStatus } from '../../inbox';

describe('Agent.run()', () => {
  let agent: Agent;
  let inbox: Inbox;
  let storage: InMemoryInboxStorage;
  let mockMastra: any;

  beforeEach(() => {
    storage = new InMemoryInboxStorage();
    mockMastra = {
      getStorage: () => ({ stores: { inbox: storage } }),
    };

    inbox = new Inbox({ id: 'test-inbox' });
    inbox.__registerMastra(mockMastra);

    agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: { provider: 'openai', name: 'gpt-4' },
    });
    agent.__registerMastra(mockMastra);

    // Mock generate to return simple response
    vi.spyOn(agent, 'generate').mockResolvedValue({
      text: 'Task completed',
      usage: { promptTokens: 10, completionTokens: 5 },
    } as any);
  });

  afterEach(() => {
    agent.stop();
    vi.restoreAllMocks();
  });

  describe('basic polling', () => {
    it('polls inbox at specified interval', async () => {
      const claimSpy = vi.spyOn(inbox, 'claim');

      const runPromise = agent.run({
        inbox,
        pollInterval: 50,
      });

      await sleep(130);
      agent.stop();
      await runPromise;

      // Should have polled multiple times
      expect(claimSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('stops when stop() called', async () => {
      const runPromise = agent.run({
        inbox,
        pollInterval: 10,
      });

      await sleep(50);
      agent.stop();
      await runPromise;

      // Should complete without hanging
      expect(true).toBe(true);
    });

    it('stops when signal aborted', async () => {
      const controller = new AbortController();

      const runPromise = agent.run({
        inbox,
        pollInterval: 10,
        signal: controller.signal,
      });

      await sleep(50);
      controller.abort();
      await runPromise;

      expect(true).toBe(true);
    });
  });

  describe('task processing', () => {
    it('claims and processes tasks', async () => {
      await inbox.add({ type: 'test', payload: { message: 'hello' } });

      const completed: any[] = [];
      const runPromise = agent.run({
        inbox,
        pollInterval: 10,
        onTaskComplete: (task, result) => {
          completed.push({ task, result });
        },
      });

      await sleep(100);
      agent.stop();
      await runPromise;

      expect(completed).toHaveLength(1);
      expect(completed[0].result.text).toBe('Task completed');
    });

    it('calls agent.generate() with task payload', async () => {
      await inbox.add({ type: 'test', payload: { question: 'What is 2+2?' } });

      const runPromise = agent.run({ inbox, pollInterval: 10 });

      await sleep(100);
      agent.stop();
      await runPromise;

      expect(agent.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('question'),
            }),
          ]),
        }),
      );
    });

    it('completes task with result', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });

      const runPromise = agent.run({ inbox, pollInterval: 10 });

      await sleep(100);
      agent.stop();
      await runPromise;

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.COMPLETED);
      expect(updated!.result).toEqual({
        text: 'Task completed',
        usage: { promptTokens: 10, completionTokens: 5 },
      });
    });

    it('fails task on error and continues loop', async () => {
      vi.spyOn(agent, 'generate')
        .mockRejectedValueOnce(new Error('LLM failed'))
        .mockResolvedValueOnce({ text: 'Success', usage: {} } as any);

      const task1 = await inbox.add({ type: 'test', payload: {} });
      const task2 = await inbox.add({ type: 'test', payload: {} });

      const errors: any[] = [];
      const completed: any[] = [];

      const runPromise = agent.run({
        inbox,
        pollInterval: 10,
        onTaskError: (task, error) => errors.push({ task, error }),
        onTaskComplete: (task, result) => completed.push({ task, result }),
      });

      await sleep(200);
      agent.stop();
      await runPromise;

      expect(errors).toHaveLength(1);
      expect(errors[0].error.message).toBe('LLM failed');
      expect(completed).toHaveLength(1);

      const updated1 = await inbox.get(task1.id);
      expect(updated1!.status).toBe(TaskStatus.PENDING); // Retryable
    });
  });

  describe('concurrency', () => {
    it('processes up to maxConcurrent tasks', async () => {
      // Slow generate
      vi.spyOn(agent, 'generate').mockImplementation(async () => {
        await sleep(100);
        return { text: 'done', usage: {} } as any;
      });

      await inbox.add({ type: 'test', payload: { n: 1 } });
      await inbox.add({ type: 'test', payload: { n: 2 } });
      await inbox.add({ type: 'test', payload: { n: 3 } });

      let maxConcurrent = 0;
      let current = 0;

      const originalGenerate = agent.generate;
      vi.spyOn(agent, 'generate').mockImplementation(async (...args) => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await sleep(50);
        current--;
        return { text: 'done', usage: {} } as any;
      });

      const runPromise = agent.run({
        inbox,
        pollInterval: 10,
        maxConcurrent: 2,
      });

      await sleep(300);
      agent.stop();
      await runPromise;

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('filtering', () => {
    it('only claims matching taskTypes', async () => {
      await inbox.add({ type: 'analyze', payload: {} });
      await inbox.add({ type: 'review', payload: {} });
      await inbox.add({ type: 'summarize', payload: {} });

      const processed: string[] = [];

      const runPromise = agent.run({
        inbox,
        pollInterval: 10,
        taskTypes: ['analyze', 'summarize'],
        onTaskComplete: task => processed.push(task.type),
      });

      await sleep(200);
      agent.stop();
      await runPromise;

      expect(processed).toContain('analyze');
      expect(processed).toContain('summarize');
      expect(processed).not.toContain('review');
    });

    it('only claims if filter() returns true', async () => {
      await inbox.add({ type: 'test', payload: { priority: 'low' } });
      await inbox.add({ type: 'test', payload: { priority: 'high' } });

      const processed: any[] = [];

      const runPromise = agent.run({
        inbox,
        pollInterval: 10,
        filter: task => (task.payload as any).priority === 'high',
        onTaskComplete: task => processed.push(task.payload),
      });

      await sleep(200);
      agent.stop();
      await runPromise;

      expect(processed).toHaveLength(1);
      expect(processed[0].priority).toBe('high');
    });
  });

  describe('multiple inboxes', () => {
    it('polls all inboxes', async () => {
      const inbox2 = new Inbox({ id: 'inbox-2' });
      inbox2.__registerMastra(mockMastra);

      await inbox.add({ type: 'from-1', payload: {} });
      await inbox2.add({ type: 'from-2', payload: {} });

      const processed: string[] = [];

      const runPromise = agent.run({
        inbox: [inbox, inbox2],
        pollInterval: 10,
        onTaskComplete: task => processed.push(task.type),
      });

      await sleep(200);
      agent.stop();
      await runPromise;

      expect(processed).toContain('from-1');
      expect(processed).toContain('from-2');
    });
  });

  describe('callbacks', () => {
    it('calls onTaskStart when task claimed', async () => {
      await inbox.add({ type: 'test', payload: {} });

      const started: any[] = [];

      const runPromise = agent.run({
        inbox,
        pollInterval: 10,
        onTaskStart: task => started.push(task),
      });

      await sleep(100);
      agent.stop();
      await runPromise;

      expect(started).toHaveLength(1);
    });

    it('calls onEmpty when no tasks', async () => {
      let emptyCount = 0;

      const runPromise = agent.run({
        inbox,
        pollInterval: 10,
        onEmpty: () => emptyCount++,
      });

      await sleep(50);
      agent.stop();
      await runPromise;

      expect(emptyCount).toBeGreaterThan(0);
    });
  });

  describe('inbox hooks', () => {
    it('calls inbox.onComplete after task success', async () => {
      const onComplete = vi.fn();
      inbox.onComplete = onComplete;

      await inbox.add({ type: 'test', payload: {} });

      const runPromise = agent.run({ inbox, pollInterval: 10 });

      await sleep(100);
      agent.stop();
      await runPromise;

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'test' }),
        expect.objectContaining({ text: 'Task completed' }),
      );
    });

    it('calls inbox.onError after task failure', async () => {
      vi.spyOn(agent, 'generate').mockRejectedValue(new Error('Failed'));

      const onError = vi.fn();
      inbox.onError = onError;

      await inbox.add({ type: 'test', payload: {} });

      const runPromise = agent.run({ inbox, pollInterval: 10 });

      await sleep(100);
      agent.stop();
      await runPromise;

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: 'test' }), expect.any(Error));
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Acceptance Criteria

- [ ] Polling behavior tested
- [ ] Task processing tested (success and failure)
- [ ] Concurrency limits tested
- [ ] Filtering tested (taskTypes, custom filter)
- [ ] Multiple inboxes tested
- [ ] All callbacks tested
- [ ] Inbox hooks tested
- [ ] Tests pass
