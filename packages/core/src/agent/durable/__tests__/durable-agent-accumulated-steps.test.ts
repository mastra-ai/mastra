/**
 * Where a DurableAgent run keeps its step records (`accumulatedSteps`), and
 * that a stored run finishes with all of them.
 *
 * New runs seed them into workflow state once and append there, so a persisted
 * snapshot holds one copy (in `value`) instead of one per step payload. Runs
 * persisted before that change keep them in step payloads and must finish that
 * way. A run stored in one workflow storage version finishes in it after the
 * agent starts storing new runs in the other.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import type { WorkflowRunState } from '../../../workflows';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';
import { storeRunsInV2 } from './storage-version';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function toolCallParts(toolName: string, id: string) {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id, modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'tool-call', toolCallType: 'function', toolCallId: id, toolName, input: '{}', providerExecuted: false },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ];
}

/** Calls `lookup`, then the approval-gated tool, then answers. */
function createModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const parts =
        calls === 1
          ? toolCallParts('lookup', 'call-1')
          : calls === 2
            ? toolCallParts('approvalTool', 'call-2')
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-3', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'done' },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage },
              ];
      return {
        stream: convertArrayToReadableStream(parts as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('DurableAgent step records', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    globalRunRegistry.clear();
    await pubsub.close();
  });

  /** `v2` sets whether it stores new runs in storage v2; it defaults to the agent's default. */
  function createAgent(storage: InMemoryStore, model: LanguageModelV2, v2?: boolean) {
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'steps-agent',
        name: 'Steps Agent',
        instructions: 'Use the tools.',
        model,
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'look something up',
            inputSchema: z.object({}),
            execute: async () => 'found',
          }),
          approvalTool: createTool({
            id: 'approvalTool',
            description: 'approval-gated tool',
            inputSchema: z.object({}),
            requireApproval: true,
            execute: async () => 'approved',
          }),
        },
      }),
      pubsub,
    });
    if (v2 !== undefined) storeRunsInV2(agent, v2);
    // Persist `running` checkpoints too, so the resumed run's writes are observable.
    new Mastra({ logger: false, storage, pubsub, agents: { stepsAgent: agent }, recovery: { durableAgents: 'auto' } });
    return agent;
  }

  async function suspendAtApproval({
    storage = new InMemoryStore(),
    model = createModel() as LanguageModelV2,
    v2,
  }: { storage?: InMemoryStore; model?: LanguageModelV2; v2?: boolean } = {}) {
    const agent = createAgent(storage, model, v2);
    const onSuspended = vi.fn();
    const initial = await agent.stream('Go', { onSuspended });
    await vi.waitFor(() => expect(onSuspended).toHaveBeenCalled());

    const workflows = (await storage.getStore('workflows'))!;
    const load = async (workflowName: string) => {
      const { runs } = await workflows.listWorkflowRuns({ workflowName });
      expect(runs).toHaveLength(1);
      return runs[0]!;
    };
    const resumeToFinish = async (by = agent) => {
      const onFinish = vi.fn();
      const resumed = await by.resume(initial.runId, { approved: true }, { onFinish });
      await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());
      resumed.cleanup();
      initial.cleanup();
      return onFinish.mock.calls[0]![0];
    };
    return { workflows, load, resumeToFinish };
  }

  it('keeps them in workflow state, not in step payloads', async () => {
    const { load, resumeToFinish } = await suspendAtApproval();

    const outer = (await load(DurableStepIds.AGENTIC_LOOP)).snapshot as WorkflowRunState;
    const nested = (await load(DurableStepIds.AGENTIC_EXECUTION)).snapshot as WorkflowRunState;
    // The first iteration (lookup) is recorded; the suspended one is not yet.
    expect(outer.value.accumulatedSteps).toEqual([expect.objectContaining({ finishReason: 'tool-calls' })]);
    expect(JSON.stringify(outer.value.accumulatedSteps)).toContain('lookup');
    expect(nested.context.input).not.toHaveProperty('accumulatedSteps');
    for (const snapshot of [outer, nested]) {
      expect(JSON.stringify(snapshot).split('"accumulatedSteps"')).toHaveLength(2);
    }

    const finish = await resumeToFinish();
    expect(finish.steps.map((step: any) => step.finishReason)).toEqual(['tool-calls', 'tool-calls', 'stop']);
    expect(finish.text).toBe('done');
  });

  it('keeps the transcript along with them when a step is aborted', async () => {
    // The first step aborts, so its partial answer is a new message: one added
    // to an earlier response message would also show up in the state the
    // step started from, which shares that message.
    const model = new MockLanguageModelV2({
      doStream: async ({ abortSignal }) => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'partial' });
            controller.enqueue({ type: 'text-delta', id: 'partial', delta: 'Partial answer' });
            abortSignal?.addEventListener(
              'abort',
              () => {
                const error = new Error('Aborted');
                error.name = 'AbortError';
                controller.error(error);
              },
              { once: true },
            );
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    const storage = new InMemoryStore();
    // Asserts on v1 snapshot writes.
    const agent = createAgent(storage, model as LanguageModelV2, false);
    const workflows = (await storage.getStore('workflows'))!;
    const written: WorkflowRunState['value'][] = [];
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    workflows.persistWorkflowSnapshot = async args => {
      written.push(JSON.parse(JSON.stringify(args.snapshot.value)));
      return persist(args);
    };
    const onAbort = vi.fn();

    const { output, abort, cleanup } = await agent.stream('Go', { onAbort });
    for await (const chunk of output.fullStream) {
      if (chunk.type === 'text-delta') await abort();
    }
    await vi.waitFor(() => expect(onAbort).toHaveBeenCalled());
    cleanup();

    // A run that crashes between the aborted step and finishing is recovered from these.
    const afterAbort = written.filter(state => state.accumulatedSteps?.length === 1 && state.messageListState);
    expect(afterAbort.length).toBeGreaterThan(0);
    for (const state of afterAbort) {
      expect(state.accumulatedSteps).toMatchObject([{ finishReason: 'abort' }]);
      expect(JSON.stringify(state.messageListState)).toContain('Partial answer');
    }
  });

  it('finishes a run persisted with them in step payloads, keeping them there', async () => {
    // Runs with step records in step payloads were only ever stored in v1.
    const { workflows, load, resumeToFinish } = await suspendAtApproval({ v2: false });

    // Rewrite the suspended run into the shape persisted before the move:
    // no step records in workflow state, the nested run's input carries them.
    for (const workflowName of [DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]) {
      const run = await load(workflowName);
      const snapshot = structuredClone(run.snapshot as WorkflowRunState);
      const steps = snapshot.value.accumulatedSteps;
      expect(steps).toHaveLength(1);
      delete snapshot.value.accumulatedSteps;
      if (workflowName === DurableStepIds.AGENTIC_EXECUTION) {
        snapshot.context.input = { ...snapshot.context.input, accumulatedSteps: steps };
      }
      await workflows.persistWorkflowSnapshot({ workflowName, runId: run.runId, snapshot });
    }

    const writes: WorkflowRunState[] = [];
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    workflows.persistWorkflowSnapshot = async args => {
      writes.push(args.snapshot);
      return persist(args);
    };

    const finish = await resumeToFinish();
    expect(finish.steps.map((step: any) => step.finishReason)).toEqual(['tool-calls', 'tool-calls', 'stop']);
    expect(JSON.stringify(finish.steps[0])).toContain('lookup');
    expect(finish.text).toBe('done');
    expect(writes.length).toBeGreaterThan(0);
    for (const snapshot of writes) {
      expect(snapshot.value).not.toHaveProperty('accumulatedSteps');
    }
  });

  it.each([
    [1, 2],
    [2, 1],
  ])('finishes a run stored in v%i in that version after a restart stores new runs in v%i', async (from, to) => {
    const storage = new InMemoryStore();
    const model = createModel() as LanguageModelV2;
    const { workflows, resumeToFinish } = await suspendAtApproval({ storage, model, v2: from === 2 });

    const writesIn = (version: 1 | 2) =>
      (version === 1
        ? [vi.spyOn(workflows, 'persistWorkflowSnapshot'), vi.spyOn(workflows, 'updateWorkflowState')]
        : [
            vi.spyOn(workflows, 'appendWorkflowRunEntries'),
            vi.spyOn(workflows, 'writeWorkflowRunCheckpoint'),
            vi.spyOn(workflows, 'updateWorkflowRunHeader'),
          ]
      ).map(spy => spy.mock.calls);
    const count = (calls: unknown[][][]) => calls.reduce((n, c) => n + c.length, 0);
    const [fromWrites, toWrites] = [writesIn(from as 1 | 2), writesIn(to as 1 | 2)];

    // A new process, whose agent stores new runs in the other version.
    globalRunRegistry.clear();
    const restarted = createAgent(storage, model, to === 2);

    const finish = await resumeToFinish(restarted);
    expect(finish.steps.map((step: any) => step.finishReason)).toEqual(['tool-calls', 'tool-calls', 'stop']);
    expect(JSON.stringify(finish.steps[0])).toContain('lookup');
    expect(finish.text).toBe('done');
    expect(count(fromWrites)).toBeGreaterThan(0);
    expect(count(toWrites)).toBe(0);

    // The restarted agent's new runs are stored in the other version.
    const onFinish = vi.fn();
    const fresh = await restarted.stream('Go', { onFinish });
    await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());
    fresh.cleanup();
    expect(count(toWrites)).toBeGreaterThan(0);
  });
});
