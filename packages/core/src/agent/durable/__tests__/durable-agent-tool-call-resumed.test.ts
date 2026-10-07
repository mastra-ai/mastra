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

    const chunks = await drain(
      await durableAgent.resume(stream.runId, { answer: 'blue' }, { toolCallId: 'tc-1', memory } as any),
    );
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
