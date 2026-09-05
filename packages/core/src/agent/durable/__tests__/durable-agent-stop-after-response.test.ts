import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AgentController } from '../../../agent-controller';
import { createMockWorkspace } from '../../../agent-controller/test-utils';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { Processor } from '../../../processors';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { MastraLanguageModelV2Mock } from '../../../test-utils/llm-mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('durable cancellation between model completion and tool execution', () => {
  it.each(['decline', 'approve', 'suspension'] as const)(
    'closes a persisted $0 through a fresh wrapper without further execution',
    async resumeKind => {
      const storage = new InMemoryStore();
      const firstPubsub = new EventEmitterPubSub();
      const resumedPubsub = new EventEmitterPubSub();
      const suspended = deferred();
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network in this test'));
      let modelCalls = 0;
      const memory = new MockMemory({ storage });
      const execute = vi.fn(async () => 'done');
      const settlements: Array<{ completedSteps: unknown; totalTokens: number | undefined; finishReason: string }> = [];
      const makeAgent = (isResuming: boolean) =>
        new Agent({
          id: 'persisted-stop-agent',
          name: 'Persisted Stop',
          instructions: 'Call action.',
          memory,
          model: new MastraLanguageModelV2Mock({
            doStream: async () => {
              if (isResuming) throw new Error('Closing a persisted approval must not call a model');
              modelCalls++;
              return {
                stream: new ReadableStream({
                  start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] });
                    controller.enqueue({
                      type: 'tool-call',
                      toolCallId: `call-${modelCalls}`,
                      toolName: 'action',
                      input: '{}',
                    });
                    controller.enqueue({
                      type: 'finish',
                      finishReason: 'tool-calls',
                      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                    });
                    controller.close();
                  },
                }),
              };
            },
          }),
          tools: {
            action: createTool({
              id: 'action',
              description: 'Local action',
              inputSchema: z.object({}),
              suspendSchema: z.object({ reason: z.string() }),
              resumeSchema: z.object({ answer: z.string() }),
              execute: async (_input, context) => {
                const result = await execute();
                if (resumeKind === 'suspension' && modelCalls === 5) return context.agent?.suspend({ reason: 'Wait' });
                return result;
              },
            }),
          },
          outputProcessors: [
            {
              id: 'saved-observation',
              async processOutputStep({ requestContext, messageList }) {
                requestContext?.set('completedSteps', Number(requestContext.get('completedSteps') ?? 0) + 1);
                return messageList;
              },
              async processOutputResult({ requestContext, result, messageList }) {
                settlements.push({
                  completedSteps: requestContext?.get('completedSteps'),
                  totalTokens: result.usage.totalTokens,
                  finishReason: result.finishReason,
                });
                return messageList;
              },
            },
          ],
        });
      const firstAgent = createDurableAgent({ agent: makeAgent(false), pubsub: firstPubsub });
      const firstMastra = new Mastra({
        agents: { agent: firstAgent },
        storage,
        pubsub: firstPubsub,
        logger: false,
        workers: false,
      });
      const first = await firstAgent.stream('Call action.', {
        requestContext: new RequestContext(),
        memory: { thread: 'persisted-stop-thread', resource: 'persisted-stop-owner' },
        requireToolApproval: () => resumeKind !== 'suspension' && modelCalls === 5,
        onSuspended: () => {
          suspended.resolve();
        },
      });
      void first.output.consumeStream().catch(() => undefined);
      await suspended.promise;
      const workflows = await storage.getStore('workflows');
      await expect
        .poll(
          async () =>
            (await workflows!.getWorkflowRunById({ runId: first.runId, workflowName: 'durable-agentic-loop' }))
              ?.snapshot?.status,
        )
        .toBe('suspended');
      const secondAgent = createDurableAgent({ agent: makeAgent(true), pubsub: resumedPubsub });
      const secondMastra = new Mastra({
        agents: { agent: secondAgent },
        storage,
        pubsub: resumedPubsub,
        logger: false,
        workers: false,
      });
      const readSnapshot = vi.spyOn(workflows!, 'getWorkflowRunById');
      let resumed: Awaited<ReturnType<typeof secondAgent.resume>> | undefined;
      try {
        resumed = await secondAgent.resume(
          first.runId,
          resumeKind === 'suspension'
            ? { answer: 'unused' }
            : { approved: resumeKind === 'approve', reason: 'Aborted by user' },
          {
            toolCallId: 'call-5',
            abortSignal: AbortSignal.abort(),
          },
        );
        await resumed.output.consumeStream().catch(() => undefined);
        expect(readSnapshot).toHaveBeenCalledWith({ runId: first.runId, workflowName: 'durable-agentic-loop' });
        expect(settlements).toEqual([{ completedSteps: 5, totalTokens: 75, finishReason: 'abort' }]);
        expect(modelCalls).toBe(5);
        expect(execute).toHaveBeenCalledTimes(resumeKind === 'suspension' ? 5 : 4);
        const recalled = await memory.recall({ threadId: 'persisted-stop-thread', resourceId: 'persisted-stop-owner' });
        for (const message of recalled.messages) {
          expect(message.content.metadata?.pendingToolApprovals).toBeUndefined();
          expect(message.content.metadata?.suspendedTools).toBeUndefined();
        }
        const toolStates = recalled.messages.flatMap(message =>
          message.content.parts.flatMap(part =>
            part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-5'
              ? [part.toolInvocation.state]
              : [],
          ),
        );
        expect(toolStates).toEqual([resumeKind === 'decline' ? 'output-denied' : 'call']);
        await expect.poll(async () => (await workflows!.listWorkflowRuns({})).runs).toEqual([]);
        expect(network).not.toHaveBeenCalled();
      } finally {
        readSnapshot.mockRestore();
        resumed?.cleanup();
        first.cleanup();
        await firstMastra.stopWorkers();
        await secondMastra.stopWorkers();
        await firstPubsub.close();
        await resumedPubsub.close();
        network.mockRestore();
      }
    },
    15000,
  );

  it.each([
    { boundary: 'response', requireApproval: true },
    { boundary: 'step', requireApproval: true },
    { boundary: 'response', requireApproval: false },
    { boundary: 'step', requireApproval: false },
    { boundary: 'stream', requireApproval: true },
    { boundary: 'approval', requireApproval: true },
    { boundary: 'input', requireApproval: false },
  ])(
    'finishes after Stop at $boundary with approval $requireApproval',
    async ({ boundary, requireApproval }) => {
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('This test must not use the network'));
      const atBoundary = deferred();
      const releaseBoundary = deferred();
      const finalResults: Array<{
        finishReason: string;
        totalTokens: number | undefined;
        lastToolStates: string[];
        lastToolResults: unknown[];
      }> = [];
      const onAbort = vi.fn();
      let modelCalls = 0;
      let responseCalls = 0;
      let stepCalls = 0;
      let stopped = false;
      let approvalsAfterStop = 0;
      const execute = vi.fn(async () => 'done');
      const processor: Processor = {
        id: 'completed-response-observer',
        async processLLMResponse() {
          responseCalls++;
          if (boundary === 'response' && modelCalls === 5) {
            atBoundary.resolve();
            await releaseBoundary.promise;
          }
        },
        async processOutputStep({ messageList }) {
          stepCalls++;
          if (boundary === 'step' && modelCalls === 5) {
            atBoundary.resolve();
            await releaseBoundary.promise;
          }
          return messageList;
        },
        async processOutputResult({ result, messageList }) {
          const lastToolStates = messageList.get.all
            .db()
            .flatMap(message =>
              message.content.parts.flatMap(part =>
                part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-5'
                  ? [part.toolInvocation.state]
                  : [],
              ),
            );
          finalResults.push({
            finishReason: result.finishReason,
            totalTokens: result.usage.totalTokens,
            lastToolStates,
            lastToolResults: result.steps.at(-1)?.toolResults ?? [],
          });
          return messageList;
        },
      };
      const model = new MastraLanguageModelV2Mock({
        doStream: async ({ abortSignal }) => {
          modelCalls++;
          if (modelCalls > 5) throw new Error('Stop must not call another model');
          const call = modelCalls;
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                if (boundary === 'stream' && call === 5) {
                  abortSignal?.addEventListener(
                    'abort',
                    () => controller.error(new DOMException('Aborted', 'AbortError')),
                    { once: true },
                  );
                  atBoundary.resolve();
                  return;
                }
                controller.enqueue({ type: 'tool-call', toolCallId: `call-${call}`, toolName: 'action', input: '{}' });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                });
                controller.close();
              },
            }),
          };
        },
      });
      const base = new Agent({
        id: crypto.randomUUID(),
        name: 'Stop test',
        instructions: 'Call action.',
        model,
        tools: {
          action: createTool({
            id: 'action',
            description: 'Local action',
            inputSchema: z.object({}),
            execute,
            onInputAvailable: async () => {
              if (boundary === 'input' && modelCalls === 5) {
                atBoundary.resolve();
                await releaseBoundary.promise;
              }
            },
          }),
        },
        inputProcessors: [processor],
        outputProcessors: [processor],
        defaultOptions: { onAbort },
      });
      const pubsub = new EventEmitterPubSub();
      const agent = createDurableAgent({ agent: base, pubsub });
      const storage = new InMemoryStore();
      const mastra = new Mastra({
        agents: { agent },
        storage,
        pubsub,
        logger: false,
        workers: false,
        scheduler: { enabled: false },
      });
      await mastra.startWorkers();
      const controller = new AgentController({
        id: crypto.randomUUID(),
        storage,
        workspace: createMockWorkspace(),
        agent: agent as unknown as Agent,
        modes: [{ id: 'chat', name: 'Chat', default: true }],
        disableBuiltinTools: [
          'ask_user',
          'submit_plan',
          'task_write',
          'task_update',
          'task_complete',
          'task_check',
          'subagent',
        ],
      });
      await controller.init();
      const session = await controller.createSession({ ownerId: 'local-test-owner' });
      await session.thread.create();
      if (!requireApproval) await session.state.set({ yolo: true });
      const unsubscribe = session.subscribe(event => {
        if (event.type !== 'tool_approval_required') return;
        if (stopped && event.toolCallId === 'call-5') approvalsAfterStop++;
        if (modelCalls < 5) session.respondToToolApproval({ decision: 'approve', toolCallId: event.toolCallId });
        else if (boundary === 'approval') atBoundary.resolve();
      });
      const send = session.sendMessage({ content: 'Call action.' });
      void send.catch(() => undefined);
      try {
        await atBoundary.promise;
        expect(modelCalls).toBe(5);
        expect(execute).toHaveBeenCalledTimes(4);
        stopped = true;
        session.abort();
        releaseBoundary.resolve();
        await expect.poll(() => finalResults.length, { timeout: 2000 }).toBe(1);
        await expect.poll(() => onAbort.mock.calls.length, { timeout: 2000 }).toBe(1);
        const workflows = await storage.getStore('workflows');
        await expect.poll(async () => (await workflows!.listWorkflowRuns({})).runs, { timeout: 2000 }).toEqual([]);
        expect(execute).toHaveBeenCalledTimes(4);
        expect(modelCalls).toBe(5);
        expect(finalResults[0]).toMatchObject({ finishReason: 'abort', totalTokens: boundary === 'stream' ? 60 : 75 });
        expect(responseCalls).toBe(boundary === 'stream' ? 4 : 5);
        expect(stepCalls).toBe(boundary === 'stream' ? 4 : 5);
        if (['response', 'step', 'input'].includes(boundary)) {
          expect(finalResults[0]!.lastToolStates).toEqual(['call']);
          expect(finalResults[0]!.lastToolResults).toEqual([]);
          expect(onAbort.mock.calls[0]![0].steps.at(-1)?.toolResults).toEqual([]);
        }
        if (boundary !== 'approval') expect(approvalsAfterStop).toBe(0);
        expect(network).not.toHaveBeenCalled();
      } finally {
        releaseBoundary.resolve();
        session.abort();
        unsubscribe();
        controller.stopIntervals();
        await mastra.stopWorkers();
        await pubsub.close();
        network.mockRestore();
      }
    },
    15000,
  );
});
