import { describe, it, expect, vi, beforeAll } from 'vitest';

import type { StorageThreadType } from '../../memory/types';
import { RequestContext } from '../../request-context';
import { AgentChannels } from '../agent-channels';
import { getChatModule } from '../chat-lazy';
import { createPlanTools } from '../plan-tools';
import type { ChannelContext } from '../types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function createFakeMemoryStore() {
  const threads = new Map<string, StorageThreadType>();
  return {
    threads,
    getThreadById: async ({ threadId }: { threadId: string }) => threads.get(threadId) ?? null,
    saveThread: async ({ thread }: { thread: StorageThreadType }) => {
      threads.set(thread.id, thread);
      return thread;
    },
  };
}

function createMockAdapter(name = 'test') {
  return {
    name,
    postMessage: vi.fn().mockResolvedValue({ id: 'm1', text: 'ok' }),
    editMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    handleWebhook: vi.fn().mockResolvedValue(new Response('ok')),
    initialize: vi.fn().mockResolvedValue(undefined),
    fetchMessages: vi.fn().mockResolvedValue([]),
    encodeThreadId: vi.fn((...p: string[]) => p.join(':')),
    decodeThreadId: vi.fn((id: string) => id.split(':')),
    channelIdFromThreadId: vi.fn((id: string) => id.split(':').slice(0, 2).join(':')),
    renderFormatted: vi.fn((t: string) => t),
    fetchThread: vi.fn().mockResolvedValue(null),
    startTyping: vi.fn().mockResolvedValue(undefined),
    parseMessage: vi.fn((raw: unknown) => raw),
    userName: 'Bot',
  } as any;
}

interface Harness {
  channels: AgentChannels;
  memory: ReturnType<typeof createFakeMemoryStore>;
  tools: ReturnType<typeof createPlanTools>;
  context: { requestContext: RequestContext };
  threadId: string;
  sdkThread: any;
}

async function setupHarness(): Promise<Harness> {
  const memory = createFakeMemoryStore();
  const threadId = 'mastra-thread-1';
  const now = new Date();
  memory.threads.set(threadId, {
    id: threadId,
    resourceId: 'res-1',
    title: 't',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  } as StorageThreadType);

  const channels = new AgentChannels({
    adapters: {
      test: { adapter: createMockAdapter('test'), plan: true } as any,
    },
  });
  channels.__setAgent({
    id: 'agent-1',
    name: 'agent-1',
    getMemory: async () => memory,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  } as any);

  const sdkThread: any = {
    id: 'test:c1:t1',
    channelId: 'test:c1',
    isDM: false,
    post: vi.fn().mockResolvedValue({ id: 'plan-msg-1', text: '' }),
    startTyping: vi.fn().mockResolvedValue(undefined),
  };

  const tools = createPlanTools(channels);
  const requestContext = new RequestContext();
  requestContext.set('channel', {
    platform: 'test',
    threadId: sdkThread.id,
    mastraThreadId: threadId,
  } as ChannelContext);

  // Plan widget needs an sdkThread reference for `ensurePlanInstanceForTool`.
  // We register one upfront (mirrors what consumeAgentStream does on subscribe).
  await (channels as any).beginActivePlan({
    mastraThreadId: threadId,
    sdkThread,
    platform: 'test',
    initialMessage: 'Working…',
    completeMessage: 'Done',
    toolDisplay: 'inline',
  });

  return { channels, memory, tools, context: { requestContext }, threadId, sdkThread };
}

/**
 * Variant that only registers the plan scope (mirroring exactly what
 * `consumeAgentStream` does when plan mode is enabled but no plan has been
 * opened yet). Used to verify that the first `task_write` lazily creates the
 * active plan entry instead of failing with "No active plan for this thread".
 */
async function setupHarnessScopeOnly(): Promise<Harness> {
  const memory = createFakeMemoryStore();
  const threadId = 'mastra-thread-scope';
  const now = new Date();
  memory.threads.set(threadId, {
    id: threadId,
    resourceId: 'res-1',
    title: 't',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  } as StorageThreadType);

  const channels = new AgentChannels({
    adapters: {
      test: { adapter: createMockAdapter('test'), plan: true } as any,
    },
  });
  channels.__setAgent({
    id: 'agent-1',
    name: 'agent-1',
    getMemory: async () => memory,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  } as any);

  const sdkThread: any = {
    id: 'test:c1:t1',
    channelId: 'test:c1',
    isDM: false,
    post: vi.fn().mockResolvedValue({ id: 'plan-msg-1', text: '' }),
    startTyping: vi.fn().mockResolvedValue(undefined),
  };

  const tools = createPlanTools(channels);
  const requestContext = new RequestContext();
  requestContext.set('channel', {
    platform: 'test',
    threadId: sdkThread.id,
    mastraThreadId: threadId,
  } as ChannelContext);

  // Only register the scope — do NOT call beginActivePlan. The first task_write
  // should create the entry on demand.
  (channels as any).planScopes.set(threadId, {
    sdkThread,
    platform: 'test',
    initialMessage: 'Working…',
    completeMessage: 'Done',
    toolDisplay: 'inline',
  });

  return { channels, memory, tools, context: { requestContext }, threadId, sdkThread };
}

// Tool execute return type is `unknown` from the createTool generic; cast in
// one place so individual assertions stay tidy.
async function run(tool: any, input: any, ctx: any): Promise<any> {
  return tool.execute(input, ctx);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPlanTools', () => {
  beforeAll(async () => {
    // Plan widget is constructed via chatModule().Plan; prime the lazy import.
    await getChatModule();
  });

  describe('task_write', () => {
    it('persists the initial task list and returns ids', async () => {
      const h = await setupHarness();
      const result = await run(h.tools.task_write, { tasks: [{ title: 'first' }, { title: 'second' }] }, h.context);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].title).toBe('first');
      expect(result.tasks[0].status).toBe('pending');
      expect(result.tasks[0].id).toMatch(/^task_/);

      const stored = h.memory.threads.get(h.threadId)!.metadata as any;
      expect(stored.channelPlan.tasks).toHaveLength(2);
      expect(stored.channelPlan.status).toBe('active');
    });

    it('diffs against the previous list: new tasks added, existing tasks kept', async () => {
      const h = await setupHarness();
      const first = await run(h.tools.task_write, { tasks: [{ id: 't_a', title: 'A' }] }, h.context);
      expect(first.tasks).toEqual([{ id: 't_a', title: 'A', status: 'pending' }]);

      const second = await run(
        h.tools.task_write,
        {
          tasks: [
            { id: 't_a', title: 'A' },
            { id: 't_b', title: 'B' },
          ],
        },
        h.context,
      );
      expect(second.tasks.map((t: any) => t.id)).toEqual(['t_a', 't_b']);
    });

    it('marks dropped tasks as completed implicitly', async () => {
      const h = await setupHarness();
      await run(
        h.tools.task_write,
        {
          tasks: [
            { id: 't_a', title: 'A' },
            { id: 't_b', title: 'B' },
          ],
        },
        h.context,
      );
      const result = await run(h.tools.task_write, { tasks: [{ id: 't_b', title: 'B' }] }, h.context);
      const a = result.tasks.find((t: any) => t.id === 't_a');
      expect(a?.status).toBe('completed');
    });

    it('throws a clear error when called outside a channel-driven request', async () => {
      const h = await setupHarness();
      await expect(
        run(h.tools.task_write, { tasks: [{ title: 'x' }] }, { requestContext: new RequestContext() }),
      ).rejects.toThrow(/Plan tools can only be called from a channel-driven agent run/);
    });

    it('lazily creates the active plan entry on the first call when only a scope is registered', async () => {
      const h = await setupHarnessScopeOnly();
      // Sanity: no entry yet.
      expect((h.channels as any).activePlans.has(h.threadId)).toBe(false);

      const result = await run(h.tools.task_write, { tasks: [{ title: 'recon' }] }, h.context);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe('recon');

      // Entry now exists and the plan widget was posted to the platform.
      expect((h.channels as any).activePlans.has(h.threadId)).toBe(true);
      expect(h.sdkThread.post).toHaveBeenCalledTimes(1);

      // Persisted to thread metadata.
      const stored = h.memory.threads.get(h.threadId)!.metadata as any;
      expect(stored.channelPlan.status).toBe('active');
      expect(stored.channelPlan.tasks).toHaveLength(1);
    });
  });

  describe('task_update', () => {
    it('patches status on an existing task', async () => {
      const h = await setupHarness();
      const seeded = await run(h.tools.task_write, { tasks: [{ title: 'A' }] }, h.context);
      const id = seeded.tasks[0].id;
      const updated = await run(h.tools.task_update, { id, status: 'in_progress' }, h.context);
      expect(updated).toEqual({ ok: true, task: { id, title: 'A', status: 'in_progress' } });
    });

    it('returns { ok: false } for an unknown task id', async () => {
      const h = await setupHarness();
      await run(h.tools.task_write, { tasks: [{ title: 'A' }] }, h.context);
      const result = await run(h.tools.task_update, { id: 'nope', status: 'completed' }, h.context);
      expect(result).toEqual({ ok: false, reason: 'unknown task id' });
    });
  });

  describe('task_complete', () => {
    it('marks the matching task as completed', async () => {
      const h = await setupHarness();
      const seeded = await run(h.tools.task_write, { tasks: [{ title: 'A' }, { title: 'B' }] }, h.context);
      const id = seeded.tasks[0].id;
      const result = await run(h.tools.task_complete, { id }, h.context);
      expect(result).toEqual({ ok: true, task: { id, title: 'A', status: 'completed' } });
    });

    it('returns { ok: false } for an unknown task id', async () => {
      const h = await setupHarness();
      await run(h.tools.task_write, { tasks: [{ title: 'A' }] }, h.context);
      const result = await run(h.tools.task_complete, { id: 'nope' }, h.context);
      expect(result).toEqual({ ok: false, reason: 'unknown task id' });
    });
  });

  describe('task_check', () => {
    it('returns counts and incomplete task list', async () => {
      const h = await setupHarness();
      const seeded = await run(
        h.tools.task_write,
        { tasks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] },
        h.context,
      );
      await run(h.tools.task_complete, { id: seeded.tasks[0].id }, h.context);
      await run(h.tools.task_update, { id: seeded.tasks[1].id, status: 'in_progress' }, h.context);
      const status = await run(h.tools.task_check, {}, h.context);
      expect(status.summary).toEqual({
        total: 3,
        completed: 1,
        inProgress: 1,
        pending: 1,
        allCompleted: false,
      });
      expect(status.incompleteTasks).toHaveLength(2);
    });

    it('reports allCompleted=true when every task is completed', async () => {
      const h = await setupHarness();
      const seeded = await run(h.tools.task_write, { tasks: [{ title: 'A' }] }, h.context);
      await run(h.tools.task_complete, { id: seeded.tasks[0].id }, h.context);
      const status = await run(h.tools.task_check, {}, h.context);
      expect(status.summary.allCompleted).toBe(true);
    });
  });

  describe('complete_plan', () => {
    it('refuses to complete while tasks are incomplete and reports their ids', async () => {
      const h = await setupHarness();
      const seeded = await run(h.tools.task_write, { tasks: [{ title: 'A' }, { title: 'B' }] }, h.context);
      const result = await run(h.tools.complete_plan, {}, h.context);
      expect(result.ok).toBe(false);
      expect(result.incompleteTaskIds).toEqual(seeded.tasks.map((t: any) => t.id));

      // The plan must still be active in metadata.
      const stored = h.memory.threads.get(h.threadId)!.metadata as any;
      expect(stored.channelPlan?.status).toBe('active');
    });

    it('completes the plan when all tasks are done and clears persisted metadata', async () => {
      const h = await setupHarness();
      const seeded = await run(h.tools.task_write, { tasks: [{ title: 'A' }] }, h.context);
      await run(h.tools.task_complete, { id: seeded.tasks[0].id }, h.context);
      const result = await run(h.tools.complete_plan, {}, h.context);
      expect(result).toEqual({ ok: true });

      const stored = h.memory.threads.get(h.threadId)!.metadata as any;
      expect(stored.channelPlan).toBeUndefined();
    });

    it('completes immediately when force: true even with incomplete tasks', async () => {
      const h = await setupHarness();
      await run(h.tools.task_write, { tasks: [{ title: 'A' }] }, h.context);
      const result = await run(h.tools.complete_plan, { force: true }, h.context);
      expect(result).toEqual({ ok: true });
    });
  });
});
