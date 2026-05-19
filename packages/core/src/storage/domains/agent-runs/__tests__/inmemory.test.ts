import { describe, it, expect, beforeEach } from 'vitest';

import { InMemoryDB } from '../../inmemory-db';
import type { AgentRun, AgentRunEventInput } from '../base';
import { InMemoryAgentRunsStorage } from '../inmemory';

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    runId: 'run-1',
    agentId: 'agent-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    status: 'created',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    startedAt: null,
    finishedAt: null,
    error: null,
    finalMessageId: null,
    lastEventIndex: null,
    eventCount: 0,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<AgentRunEventInput> = {}): AgentRunEventInput {
  return {
    runId: 'run-1',
    type: 'step-start',
    data: { stepId: 'step-1' },
    createdAt: new Date('2026-01-01T00:00:01.000Z'),
    ...overrides,
  };
}

describe('InMemoryAgentRunsStorage', () => {
  let db: InMemoryDB;
  let storage: InMemoryAgentRunsStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemoryAgentRunsStorage({ db });
  });

  describe('runs', () => {
    it('creates and retrieves a run', async () => {
      const run = makeRun();

      await storage.createRun(run);

      await expect(storage.getRun('run-1')).resolves.toEqual(run);
    });

    it('throws when creating a duplicate run', async () => {
      const run = makeRun();
      await storage.createRun(run);

      await expect(storage.createRun(run)).rejects.toThrow('Agent run already exists');
    });

    it('returns clones so callers cannot mutate stored runs', async () => {
      await storage.createRun(makeRun({ metadata: { nested: { value: 'original' } } }));

      const run = await storage.getRun('run-1');
      run!.status = 'completed';
      (run!.metadata!.nested as { value: string }).value = 'mutated';

      const stored = await storage.getRun('run-1');
      expect(stored!.status).toBe('created');
      expect(stored!.metadata).toEqual({ nested: { value: 'original' } });
    });

    it('updates specific fields without replacing the whole aggregate', async () => {
      await storage.createRun(makeRun());

      const updated = await storage.updateRun('run-1', {
        status: 'running',
        startedAt: new Date('2026-01-01T00:00:02.000Z'),
      });

      expect(updated.status).toBe('running');
      expect(updated.startedAt).toEqual(new Date('2026-01-01T00:00:02.000Z'));
      expect(updated.agentId).toBe('agent-1');
      expect(updated.threadId).toBe('thread-1');
    });

    it('stores pending tool approval state on the aggregate for reloadable UIs', async () => {
      await storage.createRun(makeRun({ status: 'running' }));

      const updated = await storage.updateRun('run-1', {
        status: 'suspended',
        pendingToolCalls: [
          {
            toolCallId: 'refund-approval-1',
            toolName: 'issueRefund',
            status: 'awaiting-approval',
            args: { amount: 42_00, currency: 'USD' },
            createdAt: new Date('2026-01-01T00:00:02.000Z'),
          },
        ],
      });

      expect(updated.status).toBe('suspended');
      expect(updated.pendingToolCalls).toEqual([
        {
          toolCallId: 'refund-approval-1',
          toolName: 'issueRefund',
          status: 'awaiting-approval',
          args: { amount: 42_00, currency: 'USD' },
          createdAt: new Date('2026-01-01T00:00:02.000Z'),
        },
      ]);
    });

    it('throws when updating a missing run', async () => {
      await expect(storage.updateRun('missing', { status: 'running' })).rejects.toThrow('Agent run not found');
    });

    it('lists runs with common UI filters and pagination', async () => {
      await storage.createRun(
        makeRun({
          runId: 'run-1',
          agentId: 'agent-1',
          status: 'running',
          updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        }),
      );
      await storage.createRun(
        makeRun({
          runId: 'run-2',
          agentId: 'agent-1',
          threadId: 'thread-2',
          status: 'completed',
          updatedAt: new Date('2026-01-01T00:00:02.000Z'),
        }),
      );
      await storage.createRun(
        makeRun({
          runId: 'run-3',
          agentId: 'agent-2',
          status: 'failed',
          updatedAt: new Date('2026-01-01T00:00:03.000Z'),
        }),
      );

      const byAgent = await storage.listRuns({ agentId: 'agent-1' });
      expect(byAgent.total).toBe(2);
      expect(byAgent.runs.map(run => run.runId)).toEqual(['run-2', 'run-1']);

      const active = await storage.listRuns({ status: ['running', 'failed'] });
      expect(active.runs.map(run => run.runId)).toEqual(['run-3', 'run-1']);

      const secondPage = await storage.listRuns({ orderDirection: 'asc', perPage: 1, page: 1 });
      expect(secondPage.total).toBe(3);
      expect(secondPage.page).toBe(1);
      expect(secondPage.perPage).toBe(1);
      expect(secondPage.hasMore).toBe(true);
      expect(secondPage.runs.map(run => run.runId)).toEqual(['run-2']);

      const allRuns = await storage.listRuns({ perPage: false });
      expect(allRuns.total).toBe(3);
      expect(allRuns.perPage).toBe(false);
      expect(allRuns.hasMore).toBe(false);
      expect(allRuns.runs).toHaveLength(3);
    });

    it('does not match runs missing the selected lifecycle date in date filters', async () => {
      await storage.createRun(makeRun({ runId: 'unfinished', status: 'running', finishedAt: null }));
      await storage.createRun(
        makeRun({
          runId: 'finished',
          status: 'completed',
          finishedAt: new Date('2026-01-01T00:00:05.000Z'),
        }),
      );

      const result = await storage.listRuns({
        dateFilterBy: 'finishedAt',
        toDate: new Date('2026-01-01T00:00:10.000Z'),
      });

      expect(result.runs.map(run => run.runId)).toEqual(['finished']);
    });

    it('can filter runs with null thread or resource ids', async () => {
      await storage.createRun(makeRun({ runId: 'with-thread', threadId: 'thread-1' }));
      await storage.createRun(makeRun({ runId: 'without-thread', threadId: null, resourceId: null }));

      const withoutThread = await storage.listRuns({ threadId: null });
      expect(withoutThread.runs.map(run => run.runId)).toEqual(['without-thread']);

      const withoutResource = await storage.listRuns({ resourceId: null });
      expect(withoutResource.runs.map(run => run.runId)).toEqual(['without-thread']);
    });
  });

  describe('events', () => {
    beforeEach(async () => {
      await storage.createRun(makeRun());
    });

    it('assigns monotonic indexes when appending events', async () => {
      const first = await storage.appendEvent(makeEvent({ type: 'start' }));
      const next = await storage.appendEvents([
        makeEvent({ type: 'step-start' }),
        makeEvent({ type: 'tool-call', data: { toolName: 'lookup' } }),
      ]);

      expect(first.index).toBe(0);
      expect(next.map(event => event.index)).toEqual([1, 2]);

      const listed = await storage.listEvents('run-1');
      expect(listed.events.map(event => event.type)).toEqual(['start', 'step-start', 'tool-call']);

      const run = await storage.getRun('run-1');
      expect(run?.lastEventIndex).toBe(2);
      expect(run?.eventCount).toBe(3);
      expect(run?.updatedAt).toEqual(new Date('2026-01-01T00:00:01.000Z'));
    });

    // These stream-style event names are representative UI payloads, not a
    // canonical stream taxonomy. The stream package owns that vocabulary.
    it('stores a realistic support assistant event timeline', async () => {
      await storage.appendEvents([
        makeEvent({ type: 'start', data: { input: 'Investigate invoice inv_123' } }),
        makeEvent({ type: 'text-start', data: { id: 'text-1' } }),
        makeEvent({
          type: 'text-delta',
          data: { id: 'text-1', delta: 'I will check the invoice and payment history.' },
        }),
        makeEvent({ type: 'text-end', data: { id: 'text-1' } }),
        makeEvent({ type: 'step-start', data: { stepIndex: 0 } }),
        makeEvent({
          type: 'tool-call',
          data: { toolCallId: 'call-1', toolName: 'lookupInvoice', args: { invoiceId: 'inv_123' } },
        }),
        makeEvent({
          type: 'tool-result',
          data: { toolCallId: 'call-1', result: { status: 'overpaid', amount: 42_00 } },
        }),
        makeEvent({
          type: 'tool-call-approval',
          data: { toolCallId: 'call-2', toolName: 'issueRefund', args: { amount: 42_00 } },
        }),
        makeEvent({ type: 'tool-call-suspended', data: { reason: 'approval-required', toolCallId: 'call-2' } }),
      ]);

      await storage.updateRun('run-1', {
        status: 'suspended',
        pendingToolCalls: [
          {
            toolCallId: 'call-2',
            toolName: 'issueRefund',
            status: 'awaiting-approval',
            args: { amount: 42_00 },
          },
        ],
      });

      const events = await storage.listEvents('run-1', { afterIndex: 4 });
      expect(events.events.map(event => event.type)).toEqual([
        'tool-call',
        'tool-result',
        'tool-call-approval',
        'tool-call-suspended',
      ]);

      const run = await storage.getRun('run-1');
      expect(run?.status).toBe('suspended');
      expect(run?.pendingToolCalls?.[0]?.toolName).toBe('issueRefund');
      expect(run?.lastEventIndex).toBe(8);
      expect(run?.eventCount).toBe(9);
    });

    it('stores Mastra background task and resumed run events', async () => {
      await storage.appendEvents([
        makeEvent({ type: 'start' }),
        makeEvent({ type: 'background-task-started', data: { taskId: 'task-1', toolName: 'crawlDocs' } }),
        makeEvent({ type: 'background-task-progress', data: { taskId: 'task-1', progress: 0.5 } }),
        makeEvent({
          type: 'background-task-suspended',
          data: { taskId: 'task-1', reason: 'waiting-for-long-running-tool' },
        }),
        makeEvent({ type: 'background-task-resumed', data: { taskId: 'task-1' } }),
        makeEvent({ type: 'background-task-completed', data: { taskId: 'task-1', output: { pages: 12 } } }),
        makeEvent({ type: 'start', data: { taskId: 'task-1', resumed: true } }),
        makeEvent({ type: 'finish', data: { finishReason: 'stop', finalMessageId: 'msg-1' } }),
      ]);

      await storage.updateRun('run-1', {
        status: 'completed',
        finishedAt: new Date('2026-01-01T00:00:10.000Z'),
        finalMessageId: 'msg-1',
      });

      const backgroundEvents = await storage.listEvents('run-1', { afterIndex: 0, toIndex: 5 });
      expect(backgroundEvents.events.map(event => event.type)).toEqual([
        'background-task-started',
        'background-task-progress',
        'background-task-suspended',
        'background-task-resumed',
        'background-task-completed',
      ]);

      const run = await storage.getRun('run-1');
      expect(run?.status).toBe('completed');
      expect(run?.finalMessageId).toBe('msg-1');
      expect(run?.lastEventIndex).toBe(7);
    });

    it('stores structured output, file, source, and reasoning UI events', async () => {
      await storage.appendEvents([
        makeEvent({ type: 'reasoning-start', data: { id: 'reasoning-1' } }),
        makeEvent({ type: 'reasoning-delta', data: { id: 'reasoning-1', delta: 'Checking policy.' } }),
        makeEvent({ type: 'reasoning-end', data: { id: 'reasoning-1' } }),
        makeEvent({ type: 'source', data: { title: 'Refund policy', url: 'https://docs.example.com/refunds' } }),
        makeEvent({ type: 'file', data: { mediaType: 'application/pdf', filename: 'invoice.pdf' } }),
        makeEvent({ type: 'object', data: { object: { eligible: true } } }),
        makeEvent({ type: 'object-result', data: { object: { eligible: true, amount: 42_00 } } }),
        makeEvent({ type: 'finish', data: { finishReason: 'stop' } }),
      ]);

      const events = await storage.listEvents('run-1');
      expect(events.events.map(event => event.type)).toEqual([
        'reasoning-start',
        'reasoning-delta',
        'reasoning-end',
        'source',
        'file',
        'object',
        'object-result',
        'finish',
      ]);
    });

    it('supports explicit indexes and tails after an index', async () => {
      await storage.appendEvents([
        makeEvent({ type: 'start', index: 0 }),
        makeEvent({ type: 'step-start' }),
        makeEvent({ type: 'finish' }),
      ]);

      const listed = await storage.listEvents('run-1', { afterIndex: 0 });
      expect(listed.events.map(event => event.index)).toEqual([1, 2]);
    });

    it('does not move aggregate updatedAt backwards when appending older events', async () => {
      const updatedAt = new Date('2026-01-01T00:10:00.000Z');
      await storage.updateRun('run-1', { status: 'running', updatedAt });

      await storage.appendEvent(makeEvent({ createdAt: new Date('2026-01-01T00:00:01.000Z') }));

      const run = await storage.getRun('run-1');
      expect(run?.updatedAt).toEqual(updatedAt);
    });

    it('throws on duplicate event indexes without partial writes', async () => {
      await storage.appendEvent(makeEvent({ index: 0 }));

      await expect(
        storage.appendEvents([makeEvent({ index: 2, type: 'step-start' }), makeEvent({ index: 1, type: 'finish' })]),
      ).rejects.toThrow('Agent run event index must be contiguous');

      const listed = await storage.listEvents('run-1');
      expect(listed.events.map(event => event.index)).toEqual([0]);
    });

    it('lists events by range, limit, and descending order', async () => {
      await storage.appendEvents([
        makeEvent({ type: 'start' }),
        makeEvent({ type: 'step-start' }),
        makeEvent({ type: 'step-finish' }),
        makeEvent({ type: 'finish' }),
      ]);

      const listed = await storage.listEvents('run-1', {
        afterIndex: 0,
        toIndex: 3,
        limit: 2,
        orderDirection: 'desc',
      });

      expect(listed.total).toBe(3);
      expect(listed.events.map(event => event.index)).toEqual([3, 2]);
    });

    it('throws when appending events for a missing run', async () => {
      await expect(storage.appendEvent(makeEvent({ runId: 'missing' }))).rejects.toThrow('Agent run not found');
    });
  });

  describe('cleanup', () => {
    it('deletes a run and its events', async () => {
      await storage.createRun(makeRun());
      await storage.appendEvent(makeEvent());

      await storage.deleteRun('run-1');

      await expect(storage.getRun('run-1')).resolves.toBeNull();
      await expect(storage.listEvents('run-1')).resolves.toEqual({ events: [], total: 0 });
    });

    it('deletes runs matching a retention filter', async () => {
      await storage.createRun(
        makeRun({
          runId: 'old-finished',
          status: 'completed',
          finishedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      );
      await storage.createRun(
        makeRun({
          runId: 'new-finished',
          status: 'completed',
          finishedAt: new Date('2026-01-02T00:00:00.000Z'),
        }),
      );
      await storage.createRun(makeRun({ runId: 'old-running', status: 'running' }));
      await storage.appendEvent(makeEvent({ runId: 'old-finished' }));

      const deleted = await storage.deleteRuns({
        status: 'completed',
        dateFilterBy: 'finishedAt',
        beforeDate: new Date('2026-01-02T00:00:00.000Z'),
      });

      expect(deleted).toBe(1);
      expect(await storage.getRun('old-finished')).toBeNull();
      expect((await storage.listEvents('old-finished')).total).toBe(0);
      expect((await storage.listRuns({})).runs.map(run => run.runId)).toEqual(['new-finished', 'old-running']);
    });

    it('does not delete runs missing the selected retention date', async () => {
      await storage.createRun(makeRun({ runId: 'unfinished', status: 'running', finishedAt: null }));
      await storage.createRun(
        makeRun({
          runId: 'finished',
          status: 'completed',
          finishedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      );

      const deleted = await storage.deleteRuns({
        dateFilterBy: 'finishedAt',
        beforeDate: new Date('2026-01-02T00:00:00.000Z'),
      });

      expect(deleted).toBe(1);
      expect(await storage.getRun('unfinished')).toMatchObject({ runId: 'unfinished', status: 'running' });
      expect(await storage.getRun('finished')).toBeNull();
    });

    it('clears all runs and events', async () => {
      await storage.createRun(makeRun());
      await storage.appendEvent(makeEvent());

      await storage.dangerouslyClearAll();

      expect((await storage.listRuns()).total).toBe(0);
      expect((await storage.listEvents('run-1')).total).toBe(0);
    });
  });
});
