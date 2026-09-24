/**
 * Crash recovery for DurableAgent with `engine: 'evented'`.
 *
 * With `recovery: { durableAgents: 'auto' }` the running checkpoint is
 * persisted, so a fresh process can discover an orphaned run via
 * `listActiveRuns()` / `recoverActiveRuns()`.
 *
 * KNOWN GAP (engine-level, not durable-agent specific): the evented engine
 * only writes `activePaths` / `activeStepsPath` to the snapshot on
 * suspend/pause/terminal transitions (`updateWorkflowState`), never while the
 * run is `running`. A run that crashes mid-step therefore has
 * `activePaths: []`, `createRestartExecutionParams` produces an empty
 * execution path, and the restart fails with "Execution path is empty: []"
 * (workflow-event-processor). The second test pins that behavior: the run is
 * DISCOVERED and the failure is REPORTED (no silent loss), but re-driving a
 * mid-running evented run requires the engine to either persist active paths
 * at step boundaries (when the policy persists `running`) or derive the
 * restart path from `snapshot.context`. Suspended runs recover fully across a
 * process death — see durable-agent-evented-two-process.test.ts.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

function createToolThenTextModel(executedModels: string[], side: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      executedModels.push(side);
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName: 'slowTool',
              input: JSON.stringify({}),
              providerExecuted: false,
            },
            {
              type: 'finish' as const,
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Recovered fine' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

function buildInstance({
  side,
  pubsub,
  storage,
  executedModels,
  executedTools,
  toolBehavior,
}: {
  side: string;
  pubsub: EventEmitterPubSub;
  storage: MockStore;
  executedModels: string[];
  executedTools: string[];
  toolBehavior: 'hang' | 'resolve';
}) {
  const slowTool = createTool({
    id: 'slowTool',
    description: 'A tool that may never finish',
    inputSchema: z.object({}),
    execute: async () => {
      executedTools.push(side);
      if (toolBehavior === 'hang') {
        // Simulates the worker dying mid tool execution: the promise never
        // settles in this "process".
        return new Promise(() => {});
      }
      return 'tool-done';
    },
  });
  const agent = new Agent({
    id: 'recovery-agent',
    instructions: 'Use tools.',
    model: createToolThenTextModel(executedModels, side) as LanguageModelV2,
    tools: { slowTool },
  });
  const durableAgent = createDurableAgent({ agent, engine: 'evented' });
  const mastra = new Mastra({
    logger: false,
    storage,
    pubsub,
    agents: { [durableAgent.id]: durableAgent as any },
    recovery: { durableAgents: 'auto' },
  });
  return { durableAgent, mastra };
}

describe('DurableAgent engine: evented — crash recovery', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('persists a discoverable running checkpoint when a worker dies mid tool call', async () => {
    const storage = new MockStore();
    const executedModels: string[] = [];
    const executedTools: string[] = [];

    // ---- Process 1: run gets stuck inside the tool call. ----
    const pubsub = new EventEmitterPubSub();
    const proc1 = buildInstance({
      side: 'proc1',
      pubsub,
      storage,
      executedModels,
      executedTools,
      toolBehavior: 'hang',
    });
    await proc1.mastra.startWorkers();

    const { output, cleanup: streamCleanup } = await proc1.durableAgent.stream('go');
    const runId = output.runId!;
    // Wait until the tool is actually in flight.
    await new Promise<void>(resolve => {
      const check = () => (executedTools.length > 0 ? resolve() : setTimeout(check, 10));
      check();
    });
    expect(executedModels).toEqual(['proc1']);
    streamCleanup?.();

    // ---- Process death: registry gone, pubsub gone; only storage survives. ----
    await pubsub.close();
    globalRunRegistry.clear();
    cleanup = async () => {};

    // The running checkpoint was persisted (recovery auto), so a fresh process
    // can discover the orphaned run.
    const workflowsStore = (await storage.getStore('workflows'))!;
    const snapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId,
    });
    expect(snapshot?.status).toBe('running');

    const listPubsub = new EventEmitterPubSub();
    const proc2 = buildInstance({
      side: 'proc2',
      pubsub: listPubsub,
      storage,
      executedModels,
      executedTools,
      toolBehavior: 'resolve',
    });
    void proc2.mastra;
    const active = await proc2.durableAgent.listActiveRuns();
    expect(active.runs.map(r => r.runId)).toContain(runId);
    cleanup = async () => {
      await listPubsub.close();
    };
  }, 30000);

  it('reports (not silently drops) mid-running restarts the evented engine cannot re-drive yet', async () => {
    const storage = new MockStore();
    const executedModels: string[] = [];
    const executedTools: string[] = [];

    // ---- Process 1: run gets stuck inside the tool call, then dies. ----
    let pubsub = new EventEmitterPubSub();
    const proc1 = buildInstance({
      side: 'proc1',
      pubsub,
      storage,
      executedModels,
      executedTools,
      toolBehavior: 'hang',
    });
    await proc1.mastra.startWorkers();
    const { output, cleanup: streamCleanup } = await proc1.durableAgent.stream('go');
    const runId = output.runId!;
    await new Promise<void>(resolve => {
      const check = () => (executedTools.length > 0 ? resolve() : setTimeout(check, 10));
      check();
    });
    streamCleanup?.();
    await pubsub.close();
    globalRunRegistry.clear();

    // ---- Process 2: recoverActiveRuns finds the run but the evented restart
    // fails (see KNOWN GAP in the file docblock). ----
    pubsub = new EventEmitterPubSub();
    const proc2 = buildInstance({
      side: 'proc2',
      pubsub,
      storage,
      executedModels,
      executedTools,
      toolBehavior: 'resolve',
    });
    await proc2.mastra.startWorkers();
    cleanup = async () => {
      await proc2.mastra.stopWorkers();
      await pubsub.close();
    };

    const result = await proc2.durableAgent.recoverActiveRuns();
    expect(result.recovered.map(r => r.runId)).toContain(runId);
    // Pin the gap: the restart is attempted and its failure is surfaced.
    // If this assertion starts failing with succeeded: 1, the engine gained
    // mid-running restart support — flip this test to assert full recovery.
    expect(result.failed).toBe(1);
    expect((result.recovered[0] as any)?.error?.message ?? String((result.recovered[0] as any)?.error)).toContain(
      'Execution path is empty',
    );
  }, 30000);
});
