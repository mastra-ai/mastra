/**
 * EventedAgent terminal snapshot cleanup (issue #22209).
 *
 * EventedAgent executes its durable workflow fire-and-forget via the evented
 * engine, so — unlike DurableAgent — it never observes the terminal result and
 * cannot delete snapshot rows itself. The evented workflow-event processor is
 * responsible: when the durable agentic workflows decline to persist a
 * terminal status (their `shouldPersistSnapshot` only keeps in-flight
 * statuses), the processor must delete the earlier 'running'/'pending' rows.
 *
 * Contract: after an EventedAgent run reaches a non-suspended terminal status,
 * neither the AGENTIC_LOOP nor the AGENTIC_EXECUTION row remains in storage,
 * so `listActiveRuns()` stops reporting the finished run and
 * `recoverActiveRuns()` stops re-executing it.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createEventedAgent } from '../create-evented-agent';
import type { EventedAgent } from '../evented-agent';

function createTextStreamModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as unknown as LanguageModelV2;
}

function createFailingModel() {
  return new MockLanguageModelV2({
    doStream: async () => {
      throw new Error('model exploded');
    },
  }) as unknown as LanguageModelV2;
}

function createSetup(model: LanguageModelV2, pubsub: EventEmitterPubSub) {
  const baseAgent = new Agent({
    id: 'evented-cleanup-agent',
    name: 'Evented Cleanup Agent',
    instructions: 'You are a helpful assistant',
    model,
  });
  const storage = new InMemoryStore();
  const agent = createEventedAgent({ agent: baseAgent, pubsub });
  // Registering on Mastra invokes __registerMastra, wiring storage into the
  // durable workflows — the same bootstrap path the server uses.
  void new Mastra({
    agents: { 'evented-cleanup-agent': agent as any },
    logger: false,
    storage,
  });
  return { agent: agent as EventedAgent, storage };
}

async function readRow(storage: InMemoryStore, workflowName: string, runId: string) {
  const workflows = (await storage.getStore('workflows'))!;
  return workflows.getWorkflowRunById({ runId, workflowName });
}

describe('EventedAgent terminal snapshot cleanup', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('deletes both AGENTIC_LOOP and AGENTIC_EXECUTION rows after a successful run', async () => {
    const { agent, storage } = createSetup(createTextStreamModel('Hello!'), pubsub);

    const { runId, output, cleanup } = await agent.stream('Hi');
    await output.consumeStream();

    // Execution is fire-and-forget: the terminal event is processed
    // asynchronously after the stream finishes, so poll for the deletes.
    await vi.waitFor(async () => {
      expect(await readRow(storage, DurableStepIds.AGENTIC_LOOP, runId)).toBeNull();
      expect(await readRow(storage, DurableStepIds.AGENTIC_EXECUTION, runId)).toBeNull();
    });

    // The whole point of the cleanup: finished runs stop showing up as active.
    const { runs, total } = await agent.listActiveRuns();
    expect(runs).toEqual([]);
    expect(total).toBe(0);

    cleanup();
  });

  it('deletes snapshot rows after a failed run', async () => {
    const { agent, storage } = createSetup(createFailingModel(), pubsub);

    const { runId, output, cleanup } = await agent.stream('Hi');
    await output.consumeStream().catch(() => {});

    await vi.waitFor(async () => {
      expect(await readRow(storage, DurableStepIds.AGENTIC_LOOP, runId)).toBeNull();
      expect(await readRow(storage, DurableStepIds.AGENTIC_EXECUTION, runId)).toBeNull();
    });

    const { runs } = await agent.listActiveRuns();
    expect(runs).toEqual([]);

    cleanup();
  });
});
