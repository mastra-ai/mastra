import type { BackgroundTasksStorage, MastraStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { createSampleTask } from './data';

export interface BackgroundTasksTestOptions {
  storage: MastraStorage;
}

export function createBackgroundTasksTests({ storage }: BackgroundTasksTestOptions) {
  let bgStorage: BackgroundTasksStorage;

  beforeAll(async () => {
    const store = await storage.getStore('backgroundTasks');
    if (!store) {
      // Domain is optional — skip if not available
      return;
    }
    bgStorage = store;
  });

  describe('Background Tasks', () => {
    beforeEach(async () => {
      if (!bgStorage) return;
      await bgStorage.dangerouslyClearAll();
    });

    describe('createTask + getTask', () => {
      it('creates and retrieves a task', async () => {
        if (!bgStorage) return;
        const task = createSampleTask();
        await bgStorage.createTask(task);

        const result = await bgStorage.getTask(task.id);
        expect(result).toBeDefined();
        expect(result!.id).toBe(task.id);
        expect(result!.toolName).toBe('test-tool');
        expect(result!.toolCallId).toBe(task.toolCallId);
        expect(result!.agentId).toBe('agent-1');
        expect(result!.status).toBe('pending');
        expect(result!.args).toEqual({ query: 'test' });
        expect(result!.retryCount).toBe(0);
        expect(result!.maxRetries).toBe(0);
        expect(result!.timeoutMs).toBe(300_000);
        expect(result!.createdAt).toBeInstanceOf(Date);
      });

      it('returns null for non-existent task', async () => {
        if (!bgStorage) return;
        const result = await bgStorage.getTask('non-existent');
        expect(result).toBeNull();
      });

      it('stores and retrieves result as JSON', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'completed',
          result: { summary: 'hello', data: [1, 2, 3] },
          completedAt: new Date(),
        });
        await bgStorage.createTask(task);

        const result = await bgStorage.getTask(task.id);
        expect(result!.result).toEqual({ summary: 'hello', data: [1, 2, 3] });
      });

      it('stores and retrieves error as JSON', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'failed',
          error: { message: 'Something broke', stack: 'at line 1' },
          completedAt: new Date(),
        });
        await bgStorage.createTask(task);

        const result = await bgStorage.getTask(task.id);
        expect(result!.error).toEqual({ message: 'Something broke', stack: 'at line 1' });
      });

      it('handles nullable fields', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({ threadId: undefined, resourceId: undefined });
        await bgStorage.createTask(task);

        const result = await bgStorage.getTask(task.id);
        expect(result!.threadId).toBeUndefined();
        expect(result!.resourceId).toBeUndefined();
      });
    });

    describe('updateTask', () => {
      it('updates status and timestamps', async () => {
        if (!bgStorage) return;
        const task = createSampleTask();
        await bgStorage.createTask(task);

        await bgStorage.updateTask(task.id, { status: 'running', startedAt: new Date() });

        const result = await bgStorage.getTask(task.id);
        expect(result!.status).toBe('running');
        expect(result!.startedAt).toBeInstanceOf(Date);
      });

      it('updates result on completion', async () => {
        if (!bgStorage) return;
        const task = createSampleTask();
        await bgStorage.createTask(task);

        await bgStorage.updateTask(task.id, {
          status: 'completed',
          result: { data: 'done' },
          completedAt: new Date(),
        });

        const result = await bgStorage.getTask(task.id);
        expect(result!.status).toBe('completed');
        expect(result!.result).toEqual({ data: 'done' });
        expect(result!.completedAt).toBeInstanceOf(Date);
      });

      it('updates retry count', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({ maxRetries: 3 });
        await bgStorage.createTask(task);

        await bgStorage.updateTask(task.id, { retryCount: 2 });

        const result = await bgStorage.getTask(task.id);
        expect(result!.retryCount).toBe(2);
      });

      it('clears error on retry', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'failed',
          error: { message: 'temp error' },
        });
        await bgStorage.createTask(task);

        await bgStorage.updateTask(task.id, { status: 'pending', error: undefined });

        const result = await bgStorage.getTask(task.id);
        expect(result!.status).toBe('pending');
        expect(result!.error).toBeUndefined();
      });

      it('persists suspendPayload and suspendedAt on suspend and clears them on resume', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({ status: 'running', startedAt: new Date() });
        await bgStorage.createTask(task);

        const suspendPayload = { awaiting: 'analyst-approval', topic: 'solana' };
        const suspendedAt = new Date();
        await bgStorage.updateTask(task.id, {
          status: 'suspended',
          suspendPayload,
          suspendedAt,
        });

        const suspended = await bgStorage.getTask(task.id);
        expect(suspended!.status).toBe('suspended');
        expect(suspended!.suspendPayload).toEqual(suspendPayload);
        expect(suspended!.suspendedAt?.getTime()).toBe(suspendedAt.getTime());

        // On resume the manager clears suspendPayload + suspendedAt and flips status back.
        await bgStorage.updateTask(task.id, {
          status: 'running',
          suspendPayload: undefined,
          suspendedAt: undefined,
        });

        const resumed = await bgStorage.getTask(task.id);
        expect(resumed!.status).toBe('running');
        expect(resumed!.suspendPayload).toBeUndefined();
        expect(resumed!.suspendedAt).toBeUndefined();
      });
    });

    describe('listTasks', () => {
      it('lists all tasks', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask());
        await bgStorage.createTask(createSampleTask());
        await bgStorage.createTask(createSampleTask());

        const { tasks, total } = await bgStorage.listTasks({});
        expect(tasks.length).toBe(3);
        expect(total).toBe(3);
      });

      it('filters by status', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'pending' }));
        await bgStorage.createTask(createSampleTask({ status: 'running', startedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'completed', completedAt: new Date() }));

        const { tasks: pending } = await bgStorage.listTasks({ status: 'pending' });
        expect(pending.length).toBe(1);

        const { tasks: multiple } = await bgStorage.listTasks({ status: ['pending', 'running'] });
        expect(multiple.length).toBe(2);
      });

      it('filters by agentId', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ agentId: 'a1' }));
        await bgStorage.createTask(createSampleTask({ agentId: 'a2' }));

        const { tasks } = await bgStorage.listTasks({ agentId: 'a1' });
        expect(tasks.length).toBe(1);
        expect(tasks[0]!.agentId).toBe('a1');
      });

      it('filters by threadId', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ threadId: 't1' }));
        await bgStorage.createTask(createSampleTask({ threadId: 't2' }));

        const { tasks } = await bgStorage.listTasks({ threadId: 't1' });
        expect(tasks.length).toBe(1);
      });

      it('filters by toolName', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ toolName: 'research' }));
        await bgStorage.createTask(createSampleTask({ toolName: 'lookup' }));

        const { tasks } = await bgStorage.listTasks({ toolName: 'research' });
        expect(tasks.length).toBe(1);
      });

      it('filters by toolCallId', async () => {
        if (!bgStorage) return;
        const target = createSampleTask({ toolCallId: 'call-target' });
        await bgStorage.createTask(target);
        await bgStorage.createTask(createSampleTask({ toolCallId: 'call-other' }));

        const { tasks } = await bgStorage.listTasks({ toolCallId: 'call-target' });
        expect(tasks.length).toBe(1);
        expect(tasks[0]!.id).toBe(target.id);
      });

      it('orders by createdAt ascending by default', async () => {
        if (!bgStorage) return;
        const t1 = new Date('2024-01-01');
        const t2 = new Date('2024-01-02');
        const t3 = new Date('2024-01-03');

        await bgStorage.createTask(createSampleTask({ id: '3', createdAt: t3 }));
        await bgStorage.createTask(createSampleTask({ id: '1', createdAt: t1 }));
        await bgStorage.createTask(createSampleTask({ id: '2', createdAt: t2 }));

        const { tasks } = await bgStorage.listTasks({});
        expect(tasks.map(t => t.id)).toEqual(['1', '2', '3']);
      });

      it('supports descending order', async () => {
        if (!bgStorage) return;
        const t1 = new Date('2024-01-01');
        const t2 = new Date('2024-01-02');

        await bgStorage.createTask(createSampleTask({ id: '1', createdAt: t1 }));
        await bgStorage.createTask(createSampleTask({ id: '2', createdAt: t2 }));

        const { tasks } = await bgStorage.listTasks({ orderDirection: 'desc' });
        expect(tasks.map(t => t.id)).toEqual(['2', '1']);
      });

      it('supports page and perPage', async () => {
        if (!bgStorage) return;
        for (let i = 0; i < 5; i++) {
          await bgStorage.createTask(createSampleTask({ id: `${i}`, createdAt: new Date(2024, 0, i + 1) }));
        }

        const { tasks: page0, total } = await bgStorage.listTasks({ page: 0, perPage: 2 });
        expect(page0.length).toBe(2);
        expect(total).toBe(5);
        expect(page0[0]!.id).toBe('0');
        expect(page0[1]!.id).toBe('1');

        const { tasks: page1 } = await bgStorage.listTasks({ page: 1, perPage: 2 });
        expect(page1.length).toBe(2);
        expect(page1[0]!.id).toBe('2');
        expect(page1[1]!.id).toBe('3');
      });
    });

    describe('deleteTask', () => {
      it('deletes a single task synchronously', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({ id: 'delete-one' });
        await bgStorage.createTask(task);

        await bgStorage.deleteTask(task.id);

        expect(await bgStorage.getTask(task.id)).toBeNull();
      });
    });

    describe('deleteTasks', () => {
      it('deletes tasks matching status filter', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'completed', completedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'completed', completedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'running', startedAt: new Date() }));

        await bgStorage.deleteTasks({ status: 'completed' });

        const { total } = await bgStorage.listTasks({});
        expect(total).toBe(1);
      });

      it('deletes with multiple status filter', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'completed', completedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'failed', completedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'pending' }));

        await bgStorage.deleteTasks({ status: ['completed', 'failed'] });

        const { total } = await bgStorage.listTasks({});
        expect(total).toBe(1);
      });
    });

    describe('getRunningCount', () => {
      it('counts running tasks', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'running', startedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'running', startedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'pending' }));

        const count = await bgStorage.getRunningCount();
        expect(count).toBe(2);
      });

      it('returns 0 when no running tasks', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'pending' }));

        const count = await bgStorage.getRunningCount();
        expect(count).toBe(0);
      });
    });

    describe('getRunningCountByAgent', () => {
      it('counts running tasks for specific agent', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'running', agentId: 'a1', startedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'running', agentId: 'a1', startedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'running', agentId: 'a2', startedAt: new Date() }));

        expect(await bgStorage.getRunningCountByAgent('a1')).toBe(2);
        expect(await bgStorage.getRunningCountByAgent('a2')).toBe(1);
        expect(await bgStorage.getRunningCountByAgent('a3')).toBe(0);
      });
    });

    describe('execution ownership', () => {
      // Adapters store timestamps with differing precision (seconds for some
      // SQL dialects, ISO strings for schemaless stores), so compare with a
      // tolerance rather than for equality.
      const expectCloseTo = (actual: Date | undefined, expected: Date) => {
        const reader = actual as unknown;
        // Some adapters hand back ISO strings rather than Date instances.
        const asDate = reader instanceof Date ? reader : new Date(reader as string);
        expect(Number.isNaN(asDate.getTime())).toBe(false);
        expect(Math.abs(asDate.getTime() - expected.getTime())).toBeLessThan(5_000);
      };

      it('round-trips ownerId and leaseExpiresAt through createTask + getTask', async () => {
        if (!bgStorage) return;
        const leaseExpiresAt = new Date(Date.now() + 60_000);
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(),
          ownerId: 'worker-a',
          leaseExpiresAt,
        });
        await bgStorage.createTask(task);

        const result = await bgStorage.getTask(task.id);
        expect(result!.ownerId).toBe('worker-a');
        expectCloseTo(result!.leaseExpiresAt, leaseExpiresAt);
      });

      it('stores no owner for an unowned task', async () => {
        if (!bgStorage) return;
        const task = createSampleTask();
        await bgStorage.createTask(task);

        const result = await bgStorage.getTask(task.id);
        expect(result!.ownerId ?? null).toBeNull();
        expect(result!.leaseExpiresAt ?? null).toBeNull();
      });

      it('claims a pending task fenced on its unowned state', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({ status: 'pending' });
        await bgStorage.createTask(task);

        const claimed = await bgStorage.updateTask(
          task.id,
          {
            status: 'running',
            startedAt: new Date(),
            ownerId: 'worker-a',
            leaseExpiresAt: new Date(Date.now() + 60_000),
          },
          { expectedStatus: 'pending', expectedOwnerId: null, expectedLeaseExpiresAt: null },
        );

        expect(claimed).toBe(true);
        const stored = await bgStorage.getTask(task.id);
        expect(stored!.status).toBe('running');
        expect(stored!.ownerId).toBe('worker-a');
        expectCloseTo(stored!.leaseExpiresAt, new Date(Date.now() + 60_000));
      });

      it('refuses a claim fenced on an owner that does not match', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(),
          ownerId: 'worker-a',
          leaseExpiresAt: new Date(Date.now() + 60_000),
        });
        await bgStorage.createTask(task);

        expect(
          await bgStorage.updateTask(
            task.id,
            { ownerId: 'worker-b', leaseExpiresAt: new Date(Date.now() + 60_000) },
            { expectedOwnerId: null },
          ),
        ).toBe(false);
        expect((await bgStorage.getTask(task.id))!.ownerId).toBe('worker-a');
      });

      it('reclaims an expired lease fenced on the stale owner and expiry', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(Date.now() - 120_000),
          ownerId: 'worker-a',
          leaseExpiresAt: new Date(Date.now() - 60_000),
        });
        await bgStorage.createTask(task);

        // Fence on the ownership state read back through the store, not on the
        // Date that was written. Adapters round-trip timestamps with differing
        // precision; a fence that only matches the original Date would fail on
        // a store that truncates or reformats it, silently stalling recovery.
        const observed = await bgStorage.getTask(task.id);
        expect(observed!.ownerId).toBe('worker-a');
        expect(observed!.leaseExpiresAt).toBeDefined();

        const reclaimed = await bgStorage.updateTask(
          task.id,
          { status: 'pending', startedAt: undefined, ownerId: undefined, leaseExpiresAt: undefined },
          {
            expectedStatus: 'running',
            expectedOwnerId: observed!.ownerId,
            expectedLeaseExpiresAt: observed!.leaseExpiresAt ?? null,
          },
        );

        expect(reclaimed).toBe(true);
        const stored = await bgStorage.getTask(task.id);
        expect(stored!.status).toBe('pending');
        expect(stored!.ownerId ?? null).toBeNull();
        expect(stored!.leaseExpiresAt ?? null).toBeNull();
      });

      it('requires the fenced lease expiry to match, not just the owner', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(Date.now() - 120_000),
          ownerId: 'worker-a',
          leaseExpiresAt: new Date(Date.now() - 60_000),
        });
        await bgStorage.createTask(task);

        expect(
          await bgStorage.updateTask(
            task.id,
            { status: 'pending', ownerId: undefined, leaseExpiresAt: undefined },
            {
              expectedStatus: 'running',
              expectedOwnerId: 'worker-a',
              expectedLeaseExpiresAt: new Date(Date.now() - 30_000),
            },
          ),
        ).toBe(false);
        expect((await bgStorage.getTask(task.id))!.status).toBe('running');
      });

      it('reclaims a running task that has no recorded ownership', async () => {
        if (!bgStorage) return;
        // Rows written before durable ownership existed carry no owner/lease.
        const task = createSampleTask({ status: 'running', startedAt: new Date(Date.now() - 60_000) });
        await bgStorage.createTask(task);

        const reclaimed = await bgStorage.updateTask(
          task.id,
          { status: 'pending', startedAt: undefined, ownerId: undefined, leaseExpiresAt: undefined },
          { expectedStatus: 'running', expectedOwnerId: null, expectedLeaseExpiresAt: null },
        );

        expect(reclaimed).toBe(true);
        expect((await bgStorage.getTask(task.id))!.status).toBe('pending');
      });

      it('rejects a reclaim that another worker already applied', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(Date.now() - 120_000),
          ownerId: 'worker-a',
          leaseExpiresAt: new Date(Date.now() - 60_000),
        });
        await bgStorage.createTask(task);

        // Both workers read the same stale ownership back through the store and
        // race to reclaim it. The first reclaim wins; the second must be
        // rejected because that state is gone.
        const observed = await bgStorage.getTask(task.id);
        const fence = {
          expectedStatus: 'running' as const,
          expectedOwnerId: observed!.ownerId ?? null,
          expectedLeaseExpiresAt: observed!.leaseExpiresAt ?? null,
        };
        const first = await bgStorage.updateTask(
          task.id,
          { status: 'pending', ownerId: undefined, leaseExpiresAt: undefined },
          fence,
        );
        const second = await bgStorage.updateTask(
          task.id,
          { status: 'pending', ownerId: undefined, leaseExpiresAt: undefined },
          fence,
        );

        expect(first).toBe(true);
        expect(second).toBe(false);
      });

      it('renews a lease fenced on the current owner', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(),
          ownerId: 'worker-a',
          leaseExpiresAt: new Date(Date.now() + 5_000),
        });
        await bgStorage.createTask(task);

        const renewed = await bgStorage.updateTask(
          task.id,
          { leaseExpiresAt: new Date(Date.now() + 60_000) },
          { expectedStatus: 'running', expectedOwnerId: 'worker-a' },
        );

        expect(renewed).toBe(true);
        expectCloseTo((await bgStorage.getTask(task.id))!.leaseExpiresAt, new Date(Date.now() + 60_000));
      });

      it('refuses to renew a lease held by another owner', async () => {
        if (!bgStorage) return;
        const leaseExpiresAt = new Date(Date.now() + 5_000);
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(),
          ownerId: 'worker-a',
          leaseExpiresAt,
        });
        await bgStorage.createTask(task);

        expect(
          await bgStorage.updateTask(
            task.id,
            { leaseExpiresAt: new Date(Date.now() + 60_000) },
            { expectedStatus: 'running', expectedOwnerId: 'worker-b' },
          ),
        ).toBe(false);
        const unchanged = await bgStorage.getTask(task.id);
        expect(unchanged!.ownerId).toBe('worker-a');
        expectCloseTo(unchanged!.leaseExpiresAt, leaseExpiresAt);
      });

      it('clears a lease fenced on its owner so another worker can take over', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(),
          ownerId: 'worker-a',
          leaseExpiresAt: new Date(Date.now() + 60_000),
        });
        await bgStorage.createTask(task);

        expect(
          await bgStorage.updateTask(
            task.id,
            { ownerId: undefined, leaseExpiresAt: undefined },
            { expectedOwnerId: 'worker-a' },
          ),
        ).toBe(true);

        const released = await bgStorage.getTask(task.id);
        expect(released!.ownerId ?? null).toBeNull();
        expect(released!.leaseExpiresAt ?? null).toBeNull();
      });

      it('refuses to clear a lease held by another owner', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(),
          ownerId: 'worker-a',
          leaseExpiresAt: new Date(Date.now() + 60_000),
        });
        await bgStorage.createTask(task);

        expect(
          await bgStorage.updateTask(
            task.id,
            { ownerId: undefined, leaseExpiresAt: undefined },
            { expectedOwnerId: 'worker-b' },
          ),
        ).toBe(false);
        expect((await bgStorage.getTask(task.id))!.ownerId).toBe('worker-a');
      });

      it('fences terminal writes on the recorded owner', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(),
          ownerId: 'worker-a',
          leaseExpiresAt: new Date(Date.now() + 60_000),
        });
        await bgStorage.createTask(task);

        const superseded = await bgStorage.updateTask(
          task.id,
          { status: 'completed', result: { won: false }, completedAt: new Date() },
          { expectedStatus: 'running', expectedOwnerId: 'worker-b' },
        );
        expect(superseded).toBe(false);
        expect((await bgStorage.getTask(task.id))!.status).toBe('running');

        const current = await bgStorage.updateTask(
          task.id,
          { status: 'completed', result: { won: true }, completedAt: new Date() },
          { expectedStatus: 'running', expectedOwnerId: 'worker-a' },
        );
        expect(current).toBe(true);
        const completed = await bgStorage.getTask(task.id);
        expect(completed!.status).toBe('completed');
        expect(completed!.result).toEqual({ won: true });
      });

      it('clears ownership when ownerId and leaseExpiresAt are written as undefined', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'running',
          startedAt: new Date(),
          ownerId: 'worker-a',
          leaseExpiresAt: new Date(Date.now() + 60_000),
        });
        await bgStorage.createTask(task);

        expect(
          await bgStorage.updateTask(task.id, {
            status: 'pending',
            startedAt: undefined,
            ownerId: undefined,
            leaseExpiresAt: undefined,
          }),
        ).toBe(true);

        const cleared = await bgStorage.getTask(task.id);
        expect(cleared!.status).toBe('pending');
        expect(cleared!.ownerId ?? null).toBeNull();
        expect(cleared!.leaseExpiresAt ?? null).toBeNull();
      });
    });
  });
}
