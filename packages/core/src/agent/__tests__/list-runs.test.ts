import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { Agent } from '../agent';

function createAgent({ durable = false }: { durable?: boolean } = {}) {
  return new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'Test instructions',
    model: new MockLanguageModelV2({}) as unknown as LanguageModelV2,
    durable,
  });
}

describe('Agent.listRuns', () => {
  it('returns suspended runs from a base agent and normalizes updatedAt', async () => {
    const agent = createAgent();
    const suspendedAt = new Date('2026-08-31T10:00:00.000Z');
    const listSuspendedRuns = vi.spyOn(agent, 'listSuspendedRuns').mockResolvedValue({
      runs: [
        {
          runId: 'suspended-run',
          status: 'suspended',
          threadId: 'thread-1',
          resourceId: 'resource-1',
          suspendedAt,
          toolCalls: [{ toolCallId: 'call-1', toolName: 'search', requiresApproval: true }],
        },
      ],
      total: 1,
    });

    const result = await agent.listRuns({ status: 'suspended', threadId: 'thread-1', resourceId: 'resource-1' });

    expect(listSuspendedRuns).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      fromDate: undefined,
      toDate: undefined,
      perPage: undefined,
      page: undefined,
    });
    expect(result).toEqual({
      runs: [
        {
          runId: 'suspended-run',
          status: 'suspended',
          threadId: 'thread-1',
          resourceId: 'resource-1',
          suspendedAt,
          updatedAt: suspendedAt,
          toolCalls: [{ toolCallId: 'call-1', toolName: 'search', requiresApproval: true }],
        },
      ],
      total: 1,
    });
  });

  it('returns no running rows for a non-durable base agent', async () => {
    const agent = createAgent();
    const listActiveRuns = vi.spyOn(agent, 'listActiveRuns');

    await expect(agent.listRuns({ status: 'running' })).resolves.toEqual({ runs: [], total: 0 });
    expect(listActiveRuns).not.toHaveBeenCalled();
  });

  it('delegates running discovery for durable agents and passes semantic filters', async () => {
    const agent = createAgent({ durable: true });
    const updatedAt = new Date('2026-08-31T11:00:00.000Z');
    const fromDate = new Date('2026-08-01T00:00:00.000Z');
    const toDate = new Date('2026-08-31T23:59:59.999Z');
    const listActiveRuns = vi.spyOn(agent, 'listActiveRuns').mockResolvedValue({
      runs: [{ runId: 'running-run', status: 'running', updatedAt }],
      total: 1,
    });
    const listSuspendedRuns = vi.spyOn(agent, 'listSuspendedRuns');

    const result = await agent.listRuns({ status: 'running', fromDate, toDate, perPage: 10, page: 0 });

    expect(listActiveRuns).toHaveBeenCalledWith({
      threadId: undefined,
      resourceId: undefined,
      fromDate,
      toDate,
      perPage: 10,
      page: 0,
    });
    expect(listSuspendedRuns).not.toHaveBeenCalled();
    expect(result).toEqual({ runs: [{ runId: 'running-run', status: 'running', updatedAt }], total: 1 });
  });

  it('resolves the registered durable wrapper when called through the original agent reference', async () => {
    const agent = createAgent({ durable: true });
    const mastra = new Mastra({ agents: { testAgent: agent } });
    const registeredAgent = mastra.getAgent('testAgent');
    const updatedAt = new Date('2026-08-31T11:00:00.000Z');
    const listActiveRuns = vi.spyOn(registeredAgent, 'listActiveRuns').mockResolvedValue({
      runs: [{ runId: 'running-run', status: 'running', updatedAt }],
      total: 1,
    });

    await expect(agent.listRuns({ status: 'running' })).resolves.toEqual({
      runs: [{ runId: 'running-run', status: 'running', updatedAt }],
      total: 1,
    });
    expect(listActiveRuns).toHaveBeenCalledOnce();
  });

  it('propagates active-run query failures from a registered durable wrapper', async () => {
    const agent = createAgent({ durable: true });
    const mastra = new Mastra({ agents: { testAgent: agent } });
    const registeredAgent = mastra.getAgent('testAgent');
    const storageError = new Error('storage unavailable');
    vi.spyOn(registeredAgent, 'listActiveRuns').mockRejectedValue(storageError);

    await expect(agent.listRuns({ status: 'running' })).rejects.toBe(storageError);
  });

  it('merges both statuses newest-first and gives suspended rows deduplication precedence', async () => {
    const agent = createAgent({ durable: true });
    const newest = new Date('2026-08-31T12:00:00.000Z');
    const middle = new Date('2026-08-31T11:00:00.000Z');
    const oldest = new Date('2026-08-31T10:00:00.000Z');

    vi.spyOn(agent, 'listActiveRuns').mockResolvedValue({
      runs: [
        { runId: 'duplicate', status: 'running', updatedAt: newest },
        { runId: 'running-run', status: 'running', updatedAt: oldest },
      ],
      total: 2,
    });
    vi.spyOn(agent, 'listSuspendedRuns').mockResolvedValue({
      runs: [
        {
          runId: 'duplicate',
          status: 'suspended',
          suspendedAt: middle,
          toolCalls: [],
        },
        {
          runId: 'suspended-run',
          status: 'suspended',
          suspendedAt: newest,
          toolCalls: [],
        },
      ],
      total: 2,
    });

    const result = await agent.listRuns();

    expect(result.total).toBe(3);
    expect(result.runs.map(run => [run.runId, run.status])).toEqual([
      ['suspended-run', 'suspended'],
      ['duplicate', 'suspended'],
      ['running-run', 'running'],
    ]);
  });

  it('calculates total before applying paired pagination', async () => {
    const agent = createAgent({ durable: true });
    vi.spyOn(agent, 'listActiveRuns').mockResolvedValue({
      runs: [
        { runId: 'run-3', status: 'running', updatedAt: new Date('2026-08-31T12:00:00.000Z') },
        { runId: 'run-1', status: 'running', updatedAt: new Date('2026-08-31T10:00:00.000Z') },
      ],
      total: 2,
    });
    vi.spyOn(agent, 'listSuspendedRuns').mockResolvedValue({
      runs: [
        {
          runId: 'run-2',
          status: 'suspended',
          suspendedAt: new Date('2026-08-31T11:00:00.000Z'),
          toolCalls: [],
        },
      ],
      total: 1,
    });

    await expect(agent.listRuns({ perPage: 1, page: 1 })).resolves.toMatchObject({
      runs: [{ runId: 'run-2' }],
      total: 3,
    });
    await expect(agent.listRuns({ perPage: 1 })).resolves.toMatchObject({
      runs: [{ runId: 'run-3' }, { runId: 'run-2' }, { runId: 'run-1' }],
      total: 3,
    });
  });

  it('validates pagination inputs', async () => {
    const agent = createAgent();

    await expect(agent.listRuns({ perPage: 0 })).rejects.toMatchObject({ id: 'AGENT_LIST_RUNS_INVALID_PER_PAGE' });
    await expect(agent.listRuns({ page: -1 })).rejects.toMatchObject({ id: 'AGENT_LIST_RUNS_INVALID_PAGE' });
  });
});
