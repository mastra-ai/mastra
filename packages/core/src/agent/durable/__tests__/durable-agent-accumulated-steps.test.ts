/**
 * Where a DurableAgent run keeps its step records (`accumulatedSteps`).
 *
 * New runs seed them into workflow state once and append there, so a persisted
 * snapshot holds one copy (in `value`) instead of one per step payload. Runs
 * persisted before that change keep them in step payloads and must finish that
 * way.
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
    globalRunRegistry.clear();
    await pubsub.close();
  });

  async function suspendAtApproval() {
    const storage = new InMemoryStore();
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'steps-agent',
        name: 'Steps Agent',
        instructions: 'Use the tools.',
        model: createModel() as LanguageModelV2,
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
    // Persist `running` checkpoints too, so the resumed run's writes are observable.
    new Mastra({ logger: false, storage, pubsub, agents: { stepsAgent: agent }, recovery: { durableAgents: 'auto' } });

    const onSuspended = vi.fn();
    const initial = await agent.stream('Go', { onSuspended });
    await vi.waitFor(() => expect(onSuspended).toHaveBeenCalled());

    const workflows = (await storage.getStore('workflows'))!;
    const load = async (workflowName: string) => {
      const { runs } = await workflows.listWorkflowRuns({ workflowName });
      expect(runs).toHaveLength(1);
      return runs[0]!;
    };
    const resumeToFinish = async () => {
      const onFinish = vi.fn();
      const resumed = await agent.resume(initial.runId, { approved: true }, { onFinish });
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

  it('finishes a run persisted with them in step payloads, keeping them there', async () => {
    const { workflows, load, resumeToFinish } = await suspendAtApproval();

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
});
