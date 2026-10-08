/**
 * #24280: the durable tool-call step must emit the live `tool-call-resumed` ack
 * alongside the persisted `resumed: true` marker, like the base loop.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { askUserTool } from '../../../tools/builtin/ask-user';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function makeModel(toolName: string, input: unknown) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasResult = JSON.stringify(prompt).includes('"type":"tool-result"');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'm', modelId: 'mock-model', timestamp: new Date(0) },
          ...(hasResult
            ? [
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage },
              ]
            : [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'tc-1',
                  toolName,
                  input: JSON.stringify(input),
                },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]),
        ]),
      };
    },
  });
}

describe('durable tool-call-resumed chunk (#24280)', () => {
  let pubsub: EventEmitterPubSub;
  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });
  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  async function runUntil(stream: { fullStream: AsyncIterable<any> }, type: string) {
    for await (const chunk of stream.fullStream) if (chunk.type === type) return chunk;
    throw new Error(`no ${type}`);
  }
  async function drain(stream: { fullStream: AsyncIterable<any> }) {
    const chunks: any[] = [];
    for await (const chunk of stream.fullStream) chunks.push(chunk);
    return chunks;
  }

  describe.each([
    ['durable', createDurableAgent],
    ['evented', createEventedAgent],
  ] as const)('%s resumed output (COR-1398)', (_engine, createWrappedAgent) => {
    it.each([false, true])(
      'retains earlier calls after a second approval (cold resume: %s)',
      async cold => {
        let modelCalls = 0;
        const model = new MockLanguageModelV2({
          doStream: async () => {
            modelCalls++;
            return {
              stream: convertArrayToReadableStream<any>([
                { type: 'stream-start', warnings: [] },
                ...(modelCalls <= 2
                  ? [{ type: 'tool-call', toolCallId: `tc-${modelCalls}`, toolName: 'gate', input: '{}' }]
                  : []),
                { type: 'finish', finishReason: modelCalls <= 2 ? 'tool-calls' : 'stop', usage },
              ]),
            };
          },
        });
        const agent = new Agent({
          id: 'repeat-approver',
          name: 'repeat-approver',
          instructions: 'do',
          model,
          tools: {
            gate: createTool({
              id: 'gate',
              description: 'Gate',
              inputSchema: z.object({}),
              requireApproval: true,
              execute: async () => 'done',
            }),
          },
        });
        const storage = new InMemoryStore();
        let wrapped = createWrappedAgent({ agent, pubsub });
        new Mastra({ agents: { wrapped }, storage, logger: false });
        const first = await wrapped.stream('go', { maxSteps: 3, closeOnSuspend: true });
        await drain(first);
        const second = await wrapped.resume(
          first.runId,
          { approved: true },
          { toolCallId: 'tc-1', closeOnSuspend: true },
        );
        await drain(second);
        if (cold) {
          await globalRunRegistry.get(first.runId)?.workflowExecution;
          await second.cleanup();
          await first.cleanup();
          await pubsub.close();
          pubsub = new EventEmitterPubSub();
          globalRunRegistry.clear();
          wrapped = createWrappedAgent({ agent, pubsub });
          new Mastra({ agents: { wrapped }, storage, logger: false });
        }
        const third = await wrapped.resume(
          first.runId,
          { approved: true },
          { toolCallId: 'tc-2', closeOnSuspend: true },
        );
        await drain(third);
        expect((await third.output.toolCalls).map(call => call.payload.toolCallId)).toEqual(['tc-1', 'tc-2']);
        await third.cleanup();
        await second.cleanup();
        await first.cleanup();
      },
      30000,
    );

    it.each([
      ['suspension', false],
      ['suspension', true],
      ['approval', false],
      ['approval', true],
    ] as const)(
      'retains the %s tool call (cold resume: %s)',
      async (kind, cold) => {
        const storage = new InMemoryStore();
        const memory = { thread: 'resumed-output', resource: 'r' };
        const agent = new Agent({
          id: 'output-asker',
          name: 'output-asker',
          instructions: 'ask',
          model: makeModel('ask', { question: 'color?' }) as LanguageModelV2,
          memory: new MockMemory(),
          tools: {
            ask: createTool({
              id: 'ask',
              description: 'Asks the user.',
              inputSchema: z.object({ question: z.string() }),
              requireApproval: kind === 'approval',
              suspendSchema: z.object({ question: z.string() }),
              resumeSchema: z.object({ answer: z.string() }),
              execute: async (input, context) => {
                if (kind === 'suspension' && !context?.agent?.resumeData) {
                  return await context?.agent?.suspend(input);
                }
                return { answer: context?.agent?.resumeData?.answer ?? 'approved' };
              },
            }),
          },
        });
        let wrapped = createWrappedAgent({ agent, pubsub });
        new Mastra({ agents: { wrapped }, storage, logger: false });
        const first = await wrapped.stream('ask', { memory, maxSteps: 3, closeOnSuspend: true });
        await drain(first);
        await vi.waitFor(async () => {
          const workflows = await storage.getStore('workflows');
          const persisted = await workflows!.getWorkflowRunById({
            runId: first.runId,
            workflowName: DurableStepIds.AGENTIC_LOOP,
          });
          const snapshot =
            typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
          expect(snapshot?.status).toBe('suspended');
        });
        if (cold) {
          await first.cleanup();
          await pubsub.close();
          pubsub = new EventEmitterPubSub();
          globalRunRegistry.clear();
          wrapped = createWrappedAgent({ agent, pubsub });
          new Mastra({ agents: { wrapped }, storage, logger: false });
        }
        const resumed = await wrapped.resume(
          first.runId,
          kind === 'approval' ? { approved: true } : { answer: 'blue' },
          { toolCallId: 'tc-1', memory },
        );
        const chunks = await drain(resumed);
        expect(await resumed.output.toolCalls).toMatchObject([
          { payload: { toolCallId: 'tc-1', toolName: 'ask', args: { question: 'color?' } } },
        ]);
        expect(await resumed.output.toolResults).toMatchObject([{ payload: { toolCallId: 'tc-1' } }]);
        expect(chunks.filter(chunk => chunk.type === 'tool-call')).toHaveLength(0);
        await resumed.cleanup();
        if (!cold) await first.cleanup();
      },
      30000,
    );
  });

  it('emits tool-call-resumed before tool-result when a suspended tool resumes', async () => {
    const memory = { thread: 'durable-resumed-suspend', resource: 'r' };
    const agent = new Agent({
      id: 'asker',
      name: 'asker',
      instructions: 'ask',
      model: makeModel('askUser', { question: 'color?' }) as LanguageModelV2,
      memory: new MockMemory(),
      tools: {
        askUser: createTool({
          id: 'ask-user',
          description: 'Asks the user.',
          inputSchema: z.object({ question: z.string() }),
          suspendSchema: z.object({ question: z.string() }),
          resumeSchema: z.object({ answer: z.string() }),
          execute: async (input: { question: string }, context: any) => {
            if (!context?.agent?.resumeData) return await context?.agent?.suspend({ question: input.question });
            return { answer: context.agent.resumeData.answer };
          },
        }),
      },
    });
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({ agents: { durableAgent }, storage: new InMemoryStore(), logger: false });

    const stream = await durableAgent.stream('ask', { memory, maxSteps: 3 });
    await runUntil(stream, 'tool-call-suspended');

    const resumed = await durableAgent.resume(stream.runId, { answer: 'blue' }, { toolCallId: 'tc-1', memory } as any);
    const chunks = await drain(resumed);
    expect(await resumed.output.toolCalls).toMatchObject([
      { payload: { toolCallId: 'tc-1', toolName: 'askUser', args: { question: 'color?' } } },
    ]);
    const acks = chunks.filter(c => c.type === 'tool-call-resumed');
    expect(acks, chunks.map(c => c.type).join(',')).toHaveLength(1);
    expect(acks[0].payload).toMatchObject({
      toolCallId: 'tc-1',
      kind: 'suspension',
      suspendPayload: { question: 'color?' },
    });
    const resultIndex = chunks.findIndex(c => c.type === 'tool-result' && c.payload.toolCallId === 'tc-1');
    expect(resultIndex).toBeGreaterThan(chunks.indexOf(acks[0]));
  }, 30000);

  it('preserves suspension resume data when a cold resume disables approval', async () => {
    const memory = { thread: 'durable-cold-resume', resource: 'r' };
    const store = new InMemoryStore();
    const modelPrompts: unknown[] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        modelPrompts.push(prompt);
        const hasResult = JSON.stringify(prompt).includes('User answered: Hilton');
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'm', modelId: 'mock-model', timestamp: new Date(0) },
            ...(hasResult
              ? [
                  { type: 'text-start', id: 't' },
                  { type: 'text-delta', id: 't', delta: 'received Hilton' },
                  { type: 'text-end', id: 't' },
                  { type: 'finish', finishReason: 'stop', usage },
                ]
              : [
                  {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'tc-1',
                    toolName: 'ask_user',
                    input: JSON.stringify({ question: 'hotel?' }),
                  },
                  { type: 'finish', finishReason: 'tool-calls', usage },
                ]),
          ]),
        };
      },
    });
    const createAgent = () => {
      const agent = new Agent({
        id: 'cold-resume-asker',
        name: 'cold-resume-asker',
        instructions: 'ask',
        model: model as LanguageModelV2,
        memory: new MockMemory(),
        tools: { ask_user: askUserTool },
      });
      const durableAgent = createDurableAgent({ agent, pubsub });
      new Mastra({ agents: { durableAgent }, storage: store, logger: false });
      return durableAgent;
    };

    const firstAgent = createAgent();
    const stream = await firstAgent.stream('ask', { memory, maxSteps: 3, requireToolApproval: () => false });
    await runUntil(stream, 'tool-call-suspended');
    const workflows = (await store.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const persisted = await workflows.getWorkflowRunById({
        runId: stream.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot?.status).toBe('suspended');
      expect(snapshot?.context?.input?.options?.requireToolApproval).toBe(true);
    });
    await pubsub.close();
    pubsub = new EventEmitterPubSub();
    globalRunRegistry.clear();

    const secondAgent = createAgent();
    await secondAgent.sendStreamResume({
      threadId: memory.thread,
      resourceId: memory.resource,
      runId: stream.runId,
      toolCallId: 'tc-1',
      resumeData: 'Hilton',
      streamOptions: { memory, maxSteps: 3, requireToolApproval: false },
    });

    await vi.waitFor(() => expect(modelPrompts).toHaveLength(2));
    const resumedPrompt = JSON.stringify(modelPrompts[1]);
    expect(resumedPrompt).toContain('User answered: Hilton');
    expect(resumedPrompt).not.toContain('Tool input validation failed');
    expect(resumedPrompt).not.toContain('"approved":true');
  }, 30000);

  it('emits an approval tool-call-resumed when an approval-gated call is approved', async () => {
    const memory = { thread: 'durable-resumed-approval', resource: 'r' };
    const agent = new Agent({
      id: 'approver',
      name: 'approver',
      instructions: 'do',
      model: makeModel('doThing', { value: 'x' }) as LanguageModelV2,
      memory: new MockMemory(),
      tools: {
        doThing: createTool({
          id: 'do-thing',
          description: 'Does a thing.',
          inputSchema: z.object({ value: z.string() }),
          requireApproval: true,
          execute: async (input: { value: string }) => ({ done: input.value }),
        }),
      },
    });
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({ agents: { durableAgent }, storage: new InMemoryStore(), logger: false });

    const stream = await durableAgent.stream('go', { memory, maxSteps: 3 });
    await runUntil(stream, 'tool-call-approval');

    const chunks = await drain(await durableAgent.approveToolCall({ runId: stream.runId, toolCallId: 'tc-1', memory }));
    const acks = chunks.filter(c => c.type === 'tool-call-resumed');
    expect(acks, chunks.map(c => c.type).join(',')).toHaveLength(1);
    expect(acks[0].payload).toMatchObject({ toolCallId: 'tc-1', kind: 'approval' });
  }, 30000);

  it('applies the display transform to the approval tool-call-resumed payload', async () => {
    const memory = { thread: 'durable-resumed-redacted', resource: 'r' };
    const agent = new Agent({
      id: 'redacted-approver',
      name: 'redacted-approver',
      instructions: 'do',
      model: makeModel('doThing', { value: 'hunter2' }) as LanguageModelV2,
      memory: new MockMemory(),
      tools: {
        doThing: createTool({
          id: 'do-thing',
          description: 'Does a thing.',
          inputSchema: z.object({ value: z.string() }),
          requireApproval: true,
          execute: async (input: { value: string }) => ({ done: input.value }),
        }),
      },
    });
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({ agents: { durableAgent }, storage: new InMemoryStore(), logger: false });

    const stream = await durableAgent.stream('go', {
      memory,
      maxSteps: 3,
      transform: { targets: ['display'], transformToolPayload: ctx => `[redacted ${ctx.phase}]` },
    } as any);
    await runUntil(stream, 'tool-call-approval');

    const chunks = await drain(await durableAgent.approveToolCall({ runId: stream.runId, toolCallId: 'tc-1', memory }));
    const ack = chunks.find(c => c.type === 'tool-call-resumed');
    expect(ack, chunks.map(c => c.type).join(',')).toBeDefined();
    const display = ack.metadata?.mastra?.toolPayloadTransform?.display;
    expect(display, JSON.stringify(ack.metadata)).toBeDefined();
    expect(JSON.stringify(display)).toContain('[redacted');
  }, 30000);
});
