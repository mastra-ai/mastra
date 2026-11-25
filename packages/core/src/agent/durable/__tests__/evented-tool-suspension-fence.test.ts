/**
 * Evented agent: a tool step whose execution loses its run while the tool suspends, or while an
 * approval reads the tool call back, must stop the step (#30123). The suspension's ownership check
 * fails; that is the run's loss, not a tool error for the model. Saving it as a tool result would let
 * the superseded execution call the model again and write a turn its successor never produced.
 *
 * The takeover is the one recover() in another process makes: it claims the run in the workflows
 * store and raises the run's memory fence to that claim. The tool step runs on a worker without the
 * run's registry entry, as a step claimed by another process does, so it reads the tool call back.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { TOOL_STEP_PATH } from '../../../workflows/evented/test-utils/redelivery-driver';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createEventedAgent } from '../create-evented-agent';
import { ExecutionFence, __resetExecutionFencesForTests } from '../execution-fence';
import { globalRunRegistry } from '../run-registry';

const THREAD = 'thread-1';
const RESOURCE = 'user-1';

/** Calls `askColour` first; any later call answers with text, which a stopped step never reaches. */
function makeModel() {
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream<any>(
        calls++ > 0
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Written by a superseded execution.' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'askColour',
                input: '{"question":"Favourite colour?"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ],
      ),
    }),
  });
  return { model, calls: () => calls };
}

/** Claim the run and raise its memory fence to that claim, as recover() in another process does. */
async function takeOver(storage: InMemoryStore, fence: ExecutionFence) {
  const claimed = await storage.stores.workflows!.claimRunOwnership({
    runId: fence.runId,
    ownerId: 'successor',
    leaseMs: 60_000,
    force: true,
  });
  expect(claimed.acquired).toBe(true);
  expect(
    await storage.stores.memory!.raiseRunFence({
      runId: fence.runId,
      generation: claimed.record!.generation,
      ownerId: 'successor',
    }),
  ).toBe(true);
}

/** Runs the tool step without the run's registry entry, and records how the tool step ended. */
class FreshWorkerToolStepPubSub extends EventEmitterPubSub {
  toolStepStarted = false;
  toolStepResults: Array<{ status?: string; output?: unknown; error?: { message?: string } }> = [];

  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: any): Promise<void> {
    const data = event.data as
      | { workflowId?: string; executionPath?: number[]; prevResult?: (typeof this.toolStepResults)[number] }
      | undefined;
    if (
      topic === 'workflows' &&
      event.type === 'workflow.step.end' &&
      data?.workflowId === DurableStepIds.AGENTIC_EXECUTION &&
      data.executionPath?.[0] === TOOL_STEP_PATH[0] &&
      data.prevResult
    ) {
      this.toolStepResults.push(data.prevResult);
    }
    if (
      topic === 'workflows' &&
      event.type === 'workflow.step.run' &&
      data?.workflowId === DurableStepIds.AGENTIC_EXECUTION &&
      data.executionPath?.length === 2 &&
      data.executionPath[0] === TOOL_STEP_PATH[0]
    ) {
      this.toolStepStarted = true;
      globalRunRegistry.clear();
    }
    return super.publish(topic, event, options);
  }
}

type Scenario = 'suspend-propagates' | 'suspend-swallowed' | 'approval';

describe.each([1, 2] as const)(
  'evented tool step that loses its run while suspending (storageVersion %s)',
  storageVersion => {
    let pubsub: EventEmitterPubSub | undefined;
    let mastra: Mastra | undefined;

    afterEach(async () => {
      await mastra?.stopWorkers();
      globalRunRegistry.clear();
      __resetExecutionFencesForTests();
      await pubsub?.close();
    });

    it.each<Scenario>(['suspend-propagates', 'suspend-swallowed', 'approval'])(
      'stops the step instead of saving the fence error as a tool result (%s)',
      async scenario => {
        const workers = new FreshWorkerToolStepPubSub();
        pubsub = workers;
        const storage = new InMemoryStore();
        const memory = new MockMemory({ storage });
        const runId = crypto.randomUUID();
        const { model, calls } = makeModel();
        let executed = 0;
        let taken = false;
        let fence!: ExecutionFence;

        const askColour = createTool({
          id: 'askColour',
          description: 'Asks the user for a colour',
          inputSchema: z.object({ question: z.string() }),
          suspendSchema: z.object({ question: z.string() }),
          resumeSchema: z.object({ colour: z.string() }),
          requireApproval: scenario === 'approval',
          execute: async (input, context: any) => {
            executed++;
            // Another process recovers the run while this one runs the tool.
            await takeOver(storage, fence);
            if (scenario === 'suspend-swallowed') {
              await context.agent.suspend({ question: input.question }).catch(() => {});
              return { colour: 'unknown' };
            }
            return await context.agent.suspend({ question: input.question });
          },
        });
        const agent = new Agent({
          id: 'colour-agent',
          name: 'colour-agent',
          instructions: 'Ask for a colour.',
          model: model as any,
          tools: { askColour },
          memory,
        });
        const evented = createEventedAgent({ agent, storageVersion });
        mastra = new Mastra({ logger: false, storage, pubsub, agents: { [evented.id]: evented } });
        await mastra.startWorkers();

        if (scenario === 'approval') {
          // Another process recovers the run as the approval reads the tool call back.
          const recall = memory.recall.bind(memory);
          memory.recall = (async (args: any) => {
            if (!taken && workers.toolStepStarted) {
              taken = true;
              await takeOver(storage, fence);
            }
            return recall(args);
          }) as typeof memory.recall;
        }

        const { output, cleanup } = await evented.stream('Ask me my colour', {
          runId,
          memory: { thread: THREAD, resource: RESOURCE },
        });
        fence = ExecutionFence.getLocalActive(runId)!;
        expect(fence).toBeDefined();
        const chunks: any[] = [];
        const reader = output.fullStream.getReader();
        void (async () => {
          for (;;) {
            const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
            if (done) return;
            chunks.push(value);
          }
        })();
        try {
          await fence.whenSettled;
          // Let anything the superseded execution would still publish arrive.
          await new Promise(resolve => setTimeout(resolve, 200));

          expect(workers.toolStepStarted).toBe(true);
          expect(executed).toBe(scenario === 'approval' ? 0 : 1);
          expect(taken).toBe(scenario === 'approval');
          // The step fails on the loss; it does not return the error as the call's result.
          expect(workers.toolStepResults).toHaveLength(1);
          expect(workers.toolStepResults[0]).toMatchObject({ status: 'failed' });
          expect(workers.toolStepResults[0]!.error?.message).toContain('lost its execution lease');
          expect(calls()).toBe(1);
          const types = chunks.map(chunk => chunk.type);
          expect(types).not.toContain('text-delta');
          expect(types).not.toContain('tool-result');
          expect(types).not.toContain('tool-error');
          expect(types).not.toContain('tool-call-suspended');
          expect(types).not.toContain('tool-call-approval');
          expect(await fence.settle(async () => {})).toBe('superseded');

          const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE, perPage: false });
          const saved = JSON.stringify(messages.map(message => message.content));
          expect(saved).not.toContain('Written by a superseded execution.');
          expect(saved).not.toContain('"state":"result"');
          expect(saved).not.toContain('suspendedTools');
          expect(saved).not.toContain('pendingToolApprovals');

          const run = await storage.stores.workflows!.getWorkflowRunById({ runId, workflowName: evented.id });
          expect((run?.snapshot as any)?.status).not.toBe('success');
        } finally {
          await reader.cancel().catch(() => {});
          cleanup();
        }
      },
      15_000,
    );
  },
);
