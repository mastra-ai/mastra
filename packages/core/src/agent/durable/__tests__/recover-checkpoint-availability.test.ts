import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import type { WorkflowRunState, WorkflowRunStatus } from '../../../workflows/types';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';

const CHECKPOINT_ERROR = 'DURABLE_AGENT_RECOVER_CHECKPOINT_NOT_AVAILABLE';

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => (resolve = done));
  return { promise, resolve };
}

function setup(policy: 'off' | 'auto' | 'custom' = 'off') {
  const entered = gate();
  const release = gate();
  let calls = 0;
  let commits = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream(
        ++calls === 1
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: 'fetch-1', toolName: 'fetchRecord', input: '{}' },
              { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1 } },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'answer' },
              { type: 'text-delta', id: 'answer', delta: '42' },
              { type: 'text-end', id: 'answer' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
            ],
      ),
    }),
  });
  const storage = new InMemoryStore();
  const pubsub = new EventEmitterPubSub();
  const makeAgent = () => {
    const runner = createDurableAgent({
      agent: new Agent({
        id: 'checkpoint-agent',
        name: 'checkpoint-agent',
        instructions: 'Fetch the record and report its amount.',
        model,
        tools: {
          fetchRecord: createTool({
            id: 'fetchRecord',
            description: 'Fetch a record',
            inputSchema: z.object({}),
            execute: async () => {
              entered.resolve();
              await release.promise;
              commits++;
              return { amount: 42 };
            },
          }),
        },
      }),
      ...(policy === 'custom'
        ? {
            shouldPersistSnapshot: ({ workflowStatus }) =>
              ['pending', 'paused', 'suspended', 'running'].includes(workflowStatus),
          }
        : {}),
    });
    new Mastra({
      agents: { runner },
      storage,
      pubsub,
      logger: false,
      recovery: { durableAgents: policy === 'auto' ? 'auto' : 'off', workflows: 'off' },
    });
    return runner;
  };
  return {
    original: makeAgent(),
    replacement: makeAgent(),
    storage,
    pubsub,
    entered,
    release,
    calls: () => calls,
    commits: () => commits,
  };
}

async function drain(stream: AsyncIterable<{ type: string }>) {
  const types: string[] = [];
  for await (const chunk of stream) types.push(chunk.type);
  return types;
}

describe('recovery checkpoint availability (COR-1493)', () => {
  it.each(['off', 'auto', 'custom'] as const)(
    'reports an unavailable checkpoint or local execution with persistence %s',
    async policy => {
      const h = setup(policy);
      const stream = await h.original.stream('Fetch the record', { runId: `checkpoint-policy-${policy}` });
      const drained = drain(stream.fullStream);
      const published: string[] = [];
      await h.pubsub.subscribe(AGENT_STREAM_TOPIC(stream.runId), async event => {
        published.push(event.type);
      });
      try {
        await h.entered.promise;
        const workflows = (await h.storage.getStore('workflows'))!;
        const row = await workflows.getWorkflowRunById({
          workflowName: DurableStepIds.AGENTIC_LOOP,
          runId: stream.runId,
        });
        const snapshot = row!.snapshot as WorkflowRunState;
        expect(snapshot.status).toBe(policy === 'off' ? 'pending' : 'running');
        expect(Object.hasOwn(snapshot.context, 'input')).toBe(policy !== 'off');
        const ownership = await workflows.getRunOwnership({ runId: stream.runId });
        for (const force of [false, true]) {
          await expect(h.replacement.recover(stream.runId, { force })).rejects.toMatchObject({
            id: policy === 'off' ? CHECKPOINT_ERROR : 'DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY',
            ...(policy === 'off' ? { message: expect.stringContaining('before starting') } : {}),
          });
        }
        expect(await workflows.getRunOwnership({ runId: stream.runId })).toEqual(ownership);
        expect(h.calls()).toBe(1);
        expect(h.commits()).toBe(0);
        expect(published).not.toContain('error');
      } finally {
        h.release.resolve();
        expect(await drained).not.toContain('error');
        expect(h.commits()).toBe(1);
      }
    },
  );

  it.each([
    ['running', {}, 'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT'],
    ['pending', null, 'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT'],
    ['pending', [], 'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT'],
    ['pending', 'invalid', 'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT'],
    ['pending', 42, 'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT'],
    ['pending', { input: null }, 'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT'],
    ['pending', { input: {} }, 'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT'],
    [
      'pending',
      { input: { __workflowKind: 'other', agentId: 'checkpoint-agent' } },
      'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT',
    ],
    [
      'running',
      { input: { __workflowKind: 'durable-agent', agentId: 'foreign' } },
      'DURABLE_AGENT_RECOVER_AGENT_MISMATCH',
    ],
    [
      'suspended',
      { input: { __workflowKind: 'durable-agent', agentId: 'checkpoint-agent' } },
      'DURABLE_AGENT_RECOVER_RUN_SUSPENDED',
    ],
  ] as const)('preserves rejection of %s snapshots with context %j', async (status, context, errorId) => {
    const h = setup();
    const workflows = (await h.storage.getStore('workflows'))!;
    const runId = crypto.randomUUID();
    await workflows.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId,
      snapshot: {
        runId,
        status: status as WorkflowRunStatus,
        context,
        value: {},
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        waitingPaths: {},
        timestamp: Date.now(),
      } as WorkflowRunState,
    });
    await expect(h.replacement.recover(runId)).rejects.toMatchObject({ id: errorId });
    expect(h.calls()).toBe(0);
    expect(await workflows.getRunOwnership({ runId })).toBeNull();
  });

  it('preserves pending snapshots that already contain the durable-agent input', async () => {
    const h = setup('auto');
    const stream = await h.original.stream('Fetch the record', { runId: 'checkpoint-valid-pending' });
    const drained = drain(stream.fullStream);
    try {
      await h.entered.promise;
      const workflows = (await h.storage.getStore('workflows'))!;
      const snapshot = (await workflows.loadWorkflowSnapshot({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        runId: stream.runId,
      }))!;
      await workflows.persistWorkflowSnapshot({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        runId: stream.runId,
        snapshot: { ...snapshot, status: 'pending' },
      });
      await expect(h.replacement.recover(stream.runId)).rejects.toMatchObject({
        id: 'DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY',
      });
    } finally {
      h.release.resolve();
      expect(await drained).not.toContain('error');
    }
  });

  it.each([false, true])(
    'releases ownership silently when the checkpoint disappears during a claim (bulk=%s)',
    async bulk => {
      const h = setup();
      const workflows = (await h.storage.getStore('workflows'))!;
      const runId = crypto.randomUUID();
      const initial = {
        runId,
        status: 'running',
        context: { input: { __workflowKind: 'durable-agent', agentId: 'checkpoint-agent' } },
        value: {},
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        waitingPaths: {},
        timestamp: Date.now(),
      } as WorkflowRunState;
      await workflows.persistWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId, snapshot: initial });
      const published: string[] = [];
      await h.pubsub.subscribe(AGENT_STREAM_TOPIC(runId), async event => {
        published.push(event.type);
      });
      const claim = workflows.claimRunOwnership.bind(workflows);
      const wrapped = vi.spyOn(workflows, 'claimRunOwnership').mockImplementationOnce(async input => {
        await workflows.persistWorkflowSnapshot({
          workflowName: DurableStepIds.AGENTIC_LOOP,
          runId,
          snapshot: { ...initial, status: 'pending', context: {} },
        });
        return claim(input);
      });
      try {
        if (bulk) {
          expect(await h.replacement.recoverActiveRuns()).toEqual({ recovered: [], succeeded: 0, failed: 0 });
        } else {
          await expect(h.replacement.recover(runId)).rejects.toMatchObject({ id: CHECKPOINT_ERROR });
        }
        expect(wrapped).toHaveBeenCalledTimes(1);
        expect((await workflows.getRunOwnership({ runId }))?.live).toBe(false);
        await expect(h.replacement.recover(runId)).rejects.toMatchObject({ id: CHECKPOINT_ERROR });
        expect(h.calls()).toBe(0);
        expect(h.commits()).toBe(0);
        expect(published).not.toContain('error');
      } finally {
        wrapped.mockRestore();
      }
    },
  );

  it('keeps a missing row distinct from a missing checkpoint', async () => {
    const h = setup();
    await expect(h.replacement.recover(crypto.randomUUID())).rejects.toMatchObject({
      id: 'DURABLE_AGENT_RECOVER_SNAPSHOT_NOT_FOUND',
    });
    expect(h.calls()).toBe(0);
  });
});
