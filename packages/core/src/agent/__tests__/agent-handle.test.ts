import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../agent';
import { Inbox, TaskStatus, TaskPriority, type Task, type IInbox } from '../../inbox';
import { InMemoryInboxStorage } from '../../storage/domains/inbox/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { MastraStorage } from '../../storage/base';
import { Mastra } from '../../mastra';

// Create a test storage setup helper
function createTestStorage() {
  const db = new InMemoryDB();
  const inboxStorage = new InMemoryInboxStorage({ db });

  const storage = new MastraStorage({
    id: 'test-storage',
    domains: {
      inbox: inboxStorage,
      memory: undefined as any,
      workflows: undefined as any,
      scores: undefined as any,
    },
  });

  return { storage, inboxStorage, db };
}

describe('Agent.handle()', () => {
  let inbox: Inbox;
  let inbox2: Inbox;
  let agent: Agent;
  let mastra: Mastra;
  let db: InMemoryDB;

  beforeEach(() => {
    const { storage, db: testDb } = createTestStorage();
    db = testDb;

    inbox = new Inbox({ id: 'test-inbox' });
    inbox2 = new Inbox({ id: 'test-inbox-2' });

    agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant',
      model: {
        provider: 'OPEN_AI',
        name: 'gpt-4o-mini',
      } as any,
    });

    mastra = new Mastra({
      storage,
      agents: { 'test-agent': agent },
      inboxes: {
        'test-inbox': inbox,
        'test-inbox-2': inbox2,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    agent?.stop();
  });

  describe('basic functionality', () => {
    it('should throw error when no inboxes provided', async () => {
      await expect(agent.handle({ inbox: [] })).rejects.toThrow('No inboxes provided');
    });

    it('should accept a single inbox', async () => {
      const abortController = new AbortController();

      // Add a task
      await inbox.add({
        type: 'test',
        payload: { message: 'Hello' },
      });

      // Start handle and immediately abort
      setTimeout(() => abortController.abort(), 50);

      await agent.handle({
        inbox,
        pollInterval: 10,
        signal: abortController.signal,
      });

      // Verify task was claimed
      const tasks = await inbox.list();
      expect(tasks.length).toBe(1);
      // Task should be claimed or in_progress
      expect([TaskStatus.CLAIMED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.FAILED]).toContain(
        tasks[0]!.status,
      );
    });

    it('should accept multiple inboxes', async () => {
      const abortController = new AbortController();

      await inbox.add({ type: 'test', payload: { source: 'inbox1' } });
      await inbox2.add({ type: 'test', payload: { source: 'inbox2' } });

      setTimeout(() => abortController.abort(), 100);

      await agent.handle({
        inbox: [inbox, inbox2],
        pollInterval: 10,
        signal: abortController.signal,
      });

      // Both inboxes should have their tasks claimed
      const tasks1 = await inbox.list();
      const tasks2 = await inbox2.list();

      expect(tasks1.length).toBe(1);
      expect(tasks2.length).toBe(1);
    });
  });

  describe('task filtering', () => {
    it('should filter tasks by type', async () => {
      const abortController = new AbortController();

      await inbox.add({ type: 'wanted', payload: {} });
      await inbox.add({ type: 'unwanted', payload: {} });

      setTimeout(() => abortController.abort(), 100);

      await agent.handle({
        inbox,
        taskTypes: ['wanted'],
        pollInterval: 10,
        signal: abortController.signal,
      });

      const tasks = await inbox.list();
      const wantedTask = tasks.find(t => t.type === 'wanted');
      const unwantedTask = tasks.find(t => t.type === 'unwanted');

      // Wanted task should be claimed/processed
      expect([TaskStatus.CLAIMED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.FAILED]).toContain(
        wantedTask!.status,
      );
      // Unwanted task should still be pending
      expect(unwantedTask!.status).toBe(TaskStatus.PENDING);
    });

    it('should filter tasks by custom filter function', async () => {
      const abortController = new AbortController();

      await inbox.add({ type: 'test', payload: { priority: 'high' } });
      await inbox.add({ type: 'test', payload: { priority: 'low' } });

      setTimeout(() => abortController.abort(), 100);

      await agent.handle({
        inbox,
        filter: task => (task.payload as any).priority === 'high',
        pollInterval: 10,
        signal: abortController.signal,
      });

      const tasks = await inbox.list();
      const highPriorityTask = tasks.find(t => (t.payload as any).priority === 'high');
      const lowPriorityTask = tasks.find(t => (t.payload as any).priority === 'low');

      expect([TaskStatus.CLAIMED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.FAILED]).toContain(
        highPriorityTask!.status,
      );
      expect(lowPriorityTask!.status).toBe(TaskStatus.PENDING);
    });
  });

  describe('callbacks', () => {
    it('should call onEmpty when no tasks available', async () => {
      const abortController = new AbortController();
      const onEmpty = vi.fn();

      setTimeout(() => abortController.abort(), 100);

      await agent.handle({
        inbox,
        onEmpty,
        pollInterval: 10,
        signal: abortController.signal,
      });

      expect(onEmpty).toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it('should stop the handle loop when stop() is called', async () => {
      const handlePromise = agent.handle({
        inbox,
        pollInterval: 10,
      });

      // Stop after a short delay
      setTimeout(() => agent.stop(), 50);

      await handlePromise;
      // If we reach here, the loop stopped successfully
      expect(true).toBe(true);
    });
  });

  describe('concurrency', () => {
    it('should respect maxConcurrent setting', async () => {
      const abortController = new AbortController();

      // Add multiple tasks
      for (let i = 0; i < 5; i++) {
        await inbox.add({ type: 'test', payload: { index: i } });
      }

      // Track concurrent tasks
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      // Override processTask to track concurrency
      const originalGenerate = agent.generate.bind(agent);
      agent.generate = vi.fn(async (...args) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        currentConcurrent--;
        return { text: 'test', object: null } as any;
      });

      setTimeout(() => abortController.abort(), 500);

      await agent.handle({
        inbox,
        maxConcurrent: 2,
        pollInterval: 10,
        signal: abortController.signal,
      });

      // Max concurrent should not exceed 2
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });
});

describe('Agent.processBatch()', () => {
  let inbox: Inbox;
  let agent: Agent;
  let mastra: Mastra;

  beforeEach(() => {
    const { storage } = createTestStorage();

    inbox = new Inbox({ id: 'batch-inbox' });

    agent = new Agent({
      name: 'batch-agent',
      instructions: 'You are a helpful assistant',
      model: {
        provider: 'OPEN_AI',
        name: 'gpt-4o-mini',
      } as any,
    });

    mastra = new Mastra({
      storage,
      agents: { 'batch-agent': agent },
      inboxes: { 'batch-inbox': inbox },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error when no inboxes provided', async () => {
    await expect(agent.processBatch({ inbox: [] })).rejects.toThrow('No inboxes provided');
  });

  it('should process up to limit tasks', async () => {
    // Add tasks
    for (let i = 0; i < 10; i++) {
      await inbox.add({ type: 'test', payload: { index: i } });
    }

    // Mock generate
    agent.generate = vi.fn().mockResolvedValue({ text: 'processed', object: null });

    const result = await agent.processBatch({
      inbox,
      limit: 3,
    });

    expect(result.processed).toBe(3);
    expect(result.tasks).toHaveLength(3);
  });

  it('should stop on timeout', async () => {
    // Add tasks
    for (let i = 0; i < 10; i++) {
      await inbox.add({ type: 'test', payload: { index: i } });
    }

    // Mock slow generate
    agent.generate = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { text: 'processed', object: null } as any;
    });

    const result = await agent.processBatch({
      inbox,
      limit: 10,
      timeout: 150, // Only enough time for ~1 task
    });

    expect(result.processed).toBeLessThan(10);
  });

  it('should track completed and failed tasks', async () => {
    await inbox.add({ type: 'success', payload: {} });
    await inbox.add({ type: 'fail', payload: {} });

    agent.generate = vi.fn(async (message: any) => {
      // Check if this is a fail task based on the message content
      const messageText = typeof message === 'string' ? message : JSON.stringify(message);
      if (messageText.includes('fail')) {
        throw new Error('Simulated failure');
      }
      return { text: 'success', object: null } as any;
    });

    const result = await agent.processBatch({
      inbox,
      limit: 10,
    });

    expect(result.processed).toBe(2);
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('should filter tasks by type', async () => {
    await inbox.add({ type: 'process', payload: {} });
    await inbox.add({ type: 'skip', payload: {} });

    agent.generate = vi.fn().mockResolvedValue({ text: 'done', object: null });

    const result = await agent.processBatch({
      inbox,
      taskTypes: ['process'],
      limit: 10,
    });

    expect(result.processed).toBe(1);

    // The skip task should still be pending
    const tasks = await inbox.list();
    const skipTask = tasks.find(t => t.type === 'skip');
    expect(skipTask!.status).toBe(TaskStatus.PENDING);
  });
});
