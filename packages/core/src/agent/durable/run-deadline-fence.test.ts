import { describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { isRunFenceConflictError } from '../../storage';
import type { MemoryStorage } from '../../storage';
import { InMemoryStore } from '../../storage/mock';
import { withRunDeadline } from './run-deadline';
import { armRunDeadline, deadlineFenceKey, runInRunDeadlineScope } from './run-deadline-fence';
import { runInRunFenceScope } from './run-fence-scope';

const agentId = 'agent-1';
const runId = 'run-1';
const thread = () => ({ id: 't-1', resourceId: 'r-1', title: '', createdAt: new Date(), updatedAt: new Date() });

async function setup() {
  const storage = new InMemoryStore();
  const memoryStore = (await storage.getStore('memory')) as MemoryStorage;
  // A remote worker rebuilds the agent's memory, so the store is resolved through the agent each time.
  const mastra = {
    getAgentById: () => ({ getMemory: async () => ({ storage }) }),
  } as unknown as Mastra;
  return { mastra, memoryStore };
}

async function arm(mastra: Mastra, budgetMs = 60_000, armingAgentId = agentId) {
  const armed = await armRunDeadline({
    mastra,
    agentId: armingAgentId,
    runId,
    requestContext: undefined,
    expiresAt: Date.now() + budgetMs,
  });
  const requestContext = new RequestContext(Object.entries(withRunDeadline({}, runId, armed.deadline)));
  const inScope = <T>(fn: () => Promise<T>) =>
    runInRunDeadlineScope({ mastra, agentId: armingAgentId, runId, requestContext }, fn);
  return { ...armed, inScope };
}

describe('run deadline fence', () => {
  it('lets scoped writes through before the deadline', async () => {
    const { mastra, memoryStore } = await setup();
    const { deadline, inScope } = await arm(mastra);

    expect(deadline.fence).toBeDefined();
    await expect(inScope(() => memoryStore.saveThread({ thread: thread() }))).resolves.toMatchObject({ id: 't-1' });
  });

  it('rejects a scoped write that reaches the store after the deadline expired', async () => {
    const { mastra, memoryStore } = await setup();
    const { expire, inScope } = await arm(mastra);

    await expect(
      inScope(async () => {
        await expire();
        return memoryStore.saveThread({ thread: thread() });
      }),
    ).rejects.toSatisfy(isRunFenceConflictError);
  });

  it('keeps unscoped writes (the accepted input save) working after the deadline', async () => {
    const { mastra, memoryStore } = await setup();
    const { expire } = await arm(mastra);
    await expire();

    await expect(memoryStore.saveThread({ thread: thread() })).resolves.toMatchObject({ id: 't-1' });
  });

  it('accepts writes from a resumed session after an earlier deadline expired', async () => {
    const { mastra, memoryStore } = await setup();
    const first = await arm(mastra);
    await first.expire();
    await new Promise(resolve => setTimeout(resolve, 2));

    const resumed = await arm(mastra);
    await expect(resumed.inScope(() => memoryStore.saveThread({ thread: thread() }))).resolves.toMatchObject({
      id: 't-1',
    });
  });

  it('accepts writes from a session resumed in the same millisecond an earlier deadline expired', async () => {
    const { mastra, memoryStore } = await setup();
    const first = await arm(mastra);
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    try {
      await first.expire();
      const resumed = await arm(mastra);

      expect(resumed.deadline.fence).toBeDefined();
      await expect(resumed.inScope(() => memoryStore.saveThread({ thread: thread() }))).resolves.toMatchObject({
        id: 't-1',
      });
    } finally {
      now.mockRestore();
    }
  });

  it('fences a session resumed with a smaller budget before the earlier deadline', async () => {
    const { mastra, memoryStore } = await setup();
    const first = await arm(mastra, 60_000);
    await first.retire();
    await new Promise(resolve => setTimeout(resolve, 2));

    const resumed = await arm(mastra, 1_000);
    expect(resumed.deadline.fence).toBeDefined();
    await expect(
      resumed.inScope(async () => {
        await resumed.expire();
        return memoryStore.saveThread({ thread: thread() });
      }),
    ).rejects.toSatisfy(isRunFenceConflictError);
  });

  it('does not fence out a resumed session when the earlier session timer fires late', async () => {
    const { mastra, memoryStore } = await setup();
    const now = vi.spyOn(Date, 'now');
    let resumed: Awaited<ReturnType<typeof arm>>;
    try {
      now.mockReturnValue(1_000);
      const first = await arm(mastra);
      now.mockReturnValue(2_000);
      resumed = await arm(mastra);
      now.mockReturnValue(3_000);
      expect(first.deadline.fence).toBeDefined();
      expect(resumed.deadline.fence!.generation).toBeGreaterThan(first.deadline.fence!.generation);
      await first.expire();
    } finally {
      now.mockRestore();
    }

    await expect(resumed.inScope(() => memoryStore.saveThread({ thread: thread() }))).resolves.toMatchObject({
      id: 't-1',
    });
  });

  it('retires the session fence so retention can prune it', async () => {
    const { mastra, memoryStore } = await setup();
    const retire = vi.spyOn(memoryStore, 'retireRunFence');
    const { deadline, retire: settle } = await arm(mastra);
    await settle();

    expect(retire).toHaveBeenCalledWith({ runId: deadlineFenceKey(agentId, runId), ...deadline.fence });
    await expect(retire.mock.results[0]!.value).resolves.toBe(true);
  });

  it('retires the expired fence and still rejects late writes', async () => {
    const { mastra, memoryStore } = await setup();
    const retire = vi.spyOn(memoryStore, 'retireRunFence');
    const { expire, inScope } = await arm(mastra);
    await expire();

    expect(retire).toHaveBeenCalledWith(
      expect.objectContaining({ runId: deadlineFenceKey(agentId, runId), ownerId: 'deadline:expired' }),
    );
    await expect(retire.mock.results[0]!.value).resolves.toBe(true);
    await expect(inScope(() => memoryStore.saveThread({ thread: thread() }))).rejects.toSatisfy(
      isRunFenceConflictError,
    );
  });

  it('does not fence out a claimed run whose id a timed stream reuses', async () => {
    const { mastra, memoryStore } = await setup();
    const claim = { runId, generation: 1, ownerId: 'execution-1' };
    await memoryStore.raiseRunFence(claim);
    const { expire } = await arm(mastra);
    await expire();

    await expect(
      runInRunFenceScope({ fenceFor: target => (target === memoryStore ? claim : undefined) }, () =>
        memoryStore.saveThread({ thread: thread() }),
      ),
    ).resolves.toMatchObject({ id: 't-1' });
  });

  it("does not fence out another agent's run that shares the run id", async () => {
    const { mastra, memoryStore } = await setup();
    const victim = await arm(mastra);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1_000);
    try {
      const other = await arm(mastra, 60_000, 'agent-2');
      await other.expire();
    } finally {
      vi.restoreAllMocks();
    }

    await expect(victim.inScope(() => memoryStore.saveThread({ thread: thread() }))).resolves.toMatchObject({
      id: 't-1',
    });
  });

  it('arms without a fence when the agent has no fencing memory store', async () => {
    const mastra = { getAgentById: () => ({ getMemory: async () => undefined }) } as unknown as Mastra;
    const { deadline, expire } = await armRunDeadline({
      mastra,
      agentId,
      runId,
      requestContext: undefined,
      expiresAt: Date.now() + 60_000,
    });

    expect(deadline.fence).toBeUndefined();
    await expect(expire()).resolves.toBeUndefined();
  });

  describe('when the fence cannot be armed', () => {
    const logger = () => ({ warn: vi.fn(), debug: vi.fn() });
    const armWith = (mastra: Mastra) =>
      armRunDeadline({ mastra, agentId, runId, requestContext: undefined, expiresAt: Date.now() + 60_000 });

    it('logs a warning and arms without a fence when the store throws on raise', async () => {
      const storage = new InMemoryStore();
      const memoryStore = (await storage.getStore('memory')) as MemoryStorage;
      vi.spyOn(memoryStore, 'raiseRunFence').mockRejectedValue(new Error('db down'));
      const log = logger();
      const mastra = {
        getAgentById: () => ({ getMemory: async () => ({ storage }) }),
        getLogger: () => log,
      } as unknown as Mastra;

      const { deadline, expire } = await armWith(mastra);

      expect(deadline.fence).toBeUndefined();
      await expect(expire()).resolves.toBeUndefined();
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn.mock.calls[0]![0]).toMatch(new RegExp(`run ${runId} \\(agent ${agentId}\\).*db down`));
      expect(log.debug).not.toHaveBeenCalled();
    });

    it('logs at debug and arms without a fence when a newer session owns it', async () => {
      const storage = new InMemoryStore();
      const memoryStore = (await storage.getStore('memory')) as MemoryStorage;
      await memoryStore.raiseRunFence({
        runId: deadlineFenceKey(agentId, runId),
        generation: Number.MAX_SAFE_INTEGER,
        ownerId: 'newer',
      });
      const log = logger();
      const mastra = {
        getAgentById: () => ({ getMemory: async () => ({ storage }) }),
        getLogger: () => log,
      } as unknown as Mastra;

      const { deadline } = await armWith(mastra);

      expect(deadline.fence).toBeUndefined();
      expect(log.debug).toHaveBeenCalledTimes(1);
      expect(log.debug.mock.calls[0]![0]).toMatch(new RegExp(`run ${runId} \\(agent ${agentId}\\).*newer session`));
      expect(log.warn).not.toHaveBeenCalled();
    });

    it('logs a warning and arms without a fence when the memory store cannot be resolved', async () => {
      const log = logger();
      const mastra = {
        getAgentById: () => ({
          getMemory: async () => {
            throw new Error('memory misconfigured');
          },
        }),
        getLogger: () => log,
      } as unknown as Mastra;

      const { deadline } = await armWith(mastra);

      expect(deadline.fence).toBeUndefined();
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn.mock.calls[0]![0]).toMatch(
        new RegExp(`run ${runId} \\(agent ${agentId}\\).*memory misconfigured`),
      );
    });
  });
});
