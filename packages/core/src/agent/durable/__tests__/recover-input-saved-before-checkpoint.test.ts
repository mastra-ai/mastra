/**
 * #30791: a durable run saves its accepted input to memory before the workflow
 * writes its first snapshot. A process that dies between the two must leave a
 * run recovery can find, or the stored user message is never answered.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createGate, createRestartScenario } from './restart-harness';

const runId = 'run-input-before-checkpoint';
const threadId = 'thread-30791';
const resourceId = 'user-30791';

function createModel(prompts: string[][]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const userTexts = prompt
        .filter(message => message.role === 'user')
        .flatMap(message => message.content)
        .flatMap(part => (part.type === 'text' ? [part.text] : []));
      prompts.push(userTexts);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'r', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: `Reply to: ${userTexts.at(-1)}` },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

describe('DurableAgent crash after the accepted input is saved (#30791)', () => {
  let stop: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it.each([
    { kind: 'durable', storageVersion: 1 },
    { kind: 'durable', storageVersion: 2 },
    { kind: 'evented', storageVersion: 1 },
    { kind: 'evented', storageVersion: 2 },
  ] as const)(
    '$kind agent (storage v$storageVersion) recovers and answers the stored user message',
    async ({ kind, storageVersion }) => {
      const crashed = createGate();
      const prompts: string[][] = [];
      const memories = new Map<number, any>();

      const scenario = createRestartScenario({
        kind,
        storageVersion,
        runId,
        build: ({ core, generation, storage }) => {
          const memory = new core.MockMemory({ storage });
          if (generation === 1) {
            const save = memory.saveMessages.bind(memory);
            memory.saveMessages = async (args: Parameters<typeof save>[0]) => {
              const saved = await save(args);
              // The process dies right after the input save returns.
              if (args.messages.some(message => message.role === 'user')) await crashed.wait();
              return saved;
            };
          }
          memories.set(generation, memory);
          return new core.Agent({
            id: 'input-before-checkpoint',
            name: 'Input before checkpoint',
            instructions: 'Reply.',
            model: createModel(prompts),
            memory,
          });
        },
      });
      stop = scenario.stop;

      const original = await scenario.start(({ agent }) =>
        agent.stream('hello', { runId, memory: { thread: threadId, resource: resourceId } }),
      );
      await crashed.reached;
      expect(prompts).toEqual([]);

      const checkpoint = await original.checkpoint();
      const recovered = await scenario.restart(checkpoint);

      expect(recovered.streamErrors).toEqual([]);
      expect(recovered.executionError).toBeUndefined();
      expect(recovered.text).toBe('Reply to: hello');
      expect(prompts).toEqual([['hello']]);

      const { messages } = await memories.get(2).recall({ threadId, resourceId });
      expect(messages.map((message: { role: string }) => message.role)).toEqual(['user', 'assistant']);
    },
  );
});

describe('start row written before the input save (#30791)', () => {
  async function setup(recovery: boolean) {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const prompts: string[][] = [];
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'start-row',
        name: 'Start row',
        instructions: 'Reply.',
        model: createModel(prompts),
        memory,
      }),
    });
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: { 'start-row': agent as any },
      ...(recovery ? { recovery: { durableAgents: 'auto' as const } } : {}),
    });
    const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
    const loopRow = (id: string) =>
      workflows.getWorkflowRunById({ runId: id, workflowName: DurableStepIds.AGENTIC_LOOP });
    return { agent, memory, storage, workflows, loopRow };
  }

  async function settle(stream: { fullStream: AsyncIterable<any> }) {
    const errors: unknown[] = [];
    for await (const chunk of stream.fullStream) if (chunk.type === 'error') errors.push(chunk.payload?.error);
    return errors;
  }

  it('is discoverable by listActiveRuns while the input save is in flight', async () => {
    const { agent, memory, loopRow } = await setup(true);
    const inSave = createGate();
    const finishSave = createGate();
    const save = memory.saveMessages.bind(memory);
    memory.saveMessages = async (args: Parameters<typeof save>[0]) => {
      if (args.messages.some(message => message.role === 'user')) {
        inSave.wait();
        await finishSave.wait();
      }
      return save(args);
    };
    const stream = await agent.stream('hello', { runId: 'r-list', memory: { thread: 't-list', resource: 'u' } });
    await inSave.reached;
    expect((await agent.listActiveRuns({ threadId: 't-list' })).runs.map(run => run.runId)).toEqual(['r-list']);
    finishSave.release();
    expect(await settle(stream)).toEqual([]);
    await vi.waitFor(async () => expect(await loopRow('r-list')).toBeNull());
  });

  it('is not written when running checkpoints are off', async () => {
    const { agent, memory, workflows } = await setup(false);
    const persist = vi.spyOn(workflows, 'persistWorkflowSnapshot');
    const save = memory.saveMessages.bind(memory);
    let runningRowsAtSave: unknown[] | undefined;
    memory.saveMessages = async (args: Parameters<typeof save>[0]) => {
      runningRowsAtSave ??= persist.mock.calls.filter(([call]) => call.snapshot.status === 'running');
      return save(args);
    };
    const stream = await agent.stream('hello', { runId: 'r-off', memory: { thread: 't-off', resource: 'u' } });
    expect(await settle(stream)).toEqual([]);
    expect(runningRowsAtSave).toEqual([]);
  });

  it('is deleted when the input save fails', async () => {
    const { agent, memory, loopRow } = await setup(true);
    memory.saveMessages = async () => {
      throw new Error('memory down');
    };
    const stream = await agent.stream('hello', { runId: 'r-save-fails', memory: { thread: 't-sf', resource: 'u' } });
    expect((await settle(stream)).length).toBeGreaterThan(0);
    expect(await loopRow('r-save-fails')).toBeNull();
    expect((await agent.listActiveRuns()).runs).toEqual([]);
  });

  it('is kept when the failing execution lost the run to another owner', async () => {
    const { agent, storage, workflows, loopRow } = await setup(true);
    // Stores that fence deletes would also refuse it; the agent must not even try.
    const deletes = vi.spyOn(workflows, 'deleteWorkflowRunById');
    vi.spyOn(agent.getWorkflow(), 'createRun').mockImplementationOnce(async ({ runId }: any) => {
      const claim = await storage.stores.workflows!.claimRunOwnership({
        runId,
        ownerId: 'replacement-execution',
        force: true,
        leaseMs: 60_000,
      });
      expect(claim.acquired).toBe(true);
      expect(
        await storage.stores.memory!.raiseRunFence({
          runId,
          ownerId: 'replacement-execution',
          generation: claim.record!.generation,
        }),
      ).toBe(true);
      throw new Error('engine down');
    });
    const createRun = vi.mocked(agent.getWorkflow().createRun);
    // The superseded execution's stream never settles; give its cleanup time to run instead.
    await agent.stream('hello', { runId: 'r-taken', memory: { thread: 't-tk', resource: 'u' } });
    await vi.waitFor(() => expect(createRun).toHaveBeenCalled());
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(deletes).not.toHaveBeenCalled();
    const row = (await loopRow('r-taken'))?.snapshot as any;
    expect(row).toMatchObject({ status: 'running', activePaths: [] });
    expect(Object.keys(row.context)).toEqual(['input']);
  });

  it('is deleted when the workflow fails to start', async () => {
    const { agent, loopRow } = await setup(true);
    vi.spyOn(agent.getWorkflow(), 'createRun').mockRejectedValueOnce(new Error('engine down'));
    const stream = await agent.stream('hello', { runId: 'r-start-fails', memory: { thread: 't-st', resource: 'u' } });
    expect((await settle(stream)).length).toBeGreaterThan(0);
    expect(await loopRow('r-start-fails')).toBeNull();
    expect((await agent.listActiveRuns()).runs).toEqual([]);
  });
});
