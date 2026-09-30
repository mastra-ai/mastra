import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Resuming a suspended tool call emits a live `tool-call-resumed` chunk on the same
 * toolCallId before its `tool-result`, mirroring the persisted `resumed: true` marker.
 * For delegations the ack carries the delegation's toolCallId, which is the id the
 * forwarded sub-agent suspension was surfaced under.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/24280
 */

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function streamOf(id: string, chunks: any[]) {
  return {
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id, modelId: 'mock-model-id', timestamp: new Date(0) },
      ...chunks,
    ] as any),
  };
}

function text(id: string, value: string) {
  return [
    { type: 'text-start', id },
    { type: 'text-delta', id, delta: value },
    { type: 'text-end', id },
    { type: 'finish', finishReason: 'stop', usage },
  ];
}

function buildAskUserTool() {
  return createTool({
    id: 'ask-user',
    description: 'Asks the user a question.',
    inputSchema: z.object({ question: z.string() }),
    suspendSchema: z.object({ question: z.string() }),
    resumeSchema: z.object({ answer: z.string() }),
    execute: async (input: { question: string }, context: any) => {
      if (!context?.agent?.resumeData) {
        return await context?.agent?.suspend({ question: input.question });
      }
      return { answer: context.agent.resumeData.answer };
    },
  });
}

function buildAgentCallingTool(id: string, toolCallId: string, toolName: string, input: unknown, extra: object) {
  let step = 0;
  return new Agent({
    id,
    name: id,
    description: 'Asks the user things.',
    instructions: 'Use your tools.',
    model: new MockLanguageModelV2({
      doStream: async () => {
        step += 1;
        return streamOf(
          `${id}-${step}`,
          step === 1
            ? [
                { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : text(`${id}-t`, 'done'),
        );
      },
    }),
    ...extra,
  });
}

async function collect(stream: any): Promise<any[]> {
  const chunks: any[] = [];
  for await (const chunk of stream.fullStream) chunks.push(chunk);
  return chunks;
}

describe('tool-call-resumed chunk (#24280)', () => {
  it('emits tool-call-resumed before tool-result when a suspended tool is resumed', async () => {
    const agent = buildAgentCallingTool(
      'asker',
      'tc-1',
      'askUser',
      { question: 'color?' },
      {
        tools: { askUser: buildAskUserTool() },
      },
    );
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

    const stream = await agent.stream('ask', { maxSteps: 3 });
    const initial = await collect(stream);
    expect(initial.some(c => c.type === 'tool-call-suspended')).toBe(true);
    expect(initial.some(c => c.type === 'tool-call-resumed')).toBe(false);

    const resumed = await agent.resumeStream({ answer: 'blue' }, { runId: stream.runId, toolCallId: 'tc-1' });
    const chunks = await collect(resumed);

    const ackIndex = chunks.findIndex(c => c.type === 'tool-call-resumed');
    const resultIndex = chunks.findIndex(c => c.type === 'tool-result' && c.payload.toolCallId === 'tc-1');
    expect(ackIndex).toBeGreaterThanOrEqual(0);
    expect(resultIndex).toBeGreaterThan(ackIndex);
    expect(chunks[ackIndex].payload).toMatchObject({
      toolCallId: 'tc-1',
      toolName: 'askUser',
      kind: 'suspension',
      suspendPayload: { question: 'color?' },
    });
    expect(chunks[ackIndex].payload.resumeSchema).toEqual(expect.any(String));
    expect(chunks.filter(c => c.type === 'tool-call-resumed')).toHaveLength(1);
    expect(chunks.some(c => c.type === 'tool-call-suspended')).toBe(false);
  });

  it('emits tool-call-resumed on the delegation toolCallId when a delegated suspension is resumed', async () => {
    const subAgent = buildAgentCallingTool(
      'sub-agent',
      'inner-tc',
      'askUser',
      { question: 'color?' },
      {
        tools: { askUser: buildAskUserTool() },
      },
    );
    const supervisor = buildAgentCallingTool(
      'supervisor',
      'sup-tc',
      'agent-subAgent',
      { prompt: 'ask the user' },
      {
        agents: { subAgent },
        memory: new MockMemory(),
      },
    );
    const mastra = new Mastra({ agents: { supervisor }, logger: false, storage: new InMemoryStore() });
    const sup = mastra.getAgent('supervisor');

    const stream = await sup.stream('go', { maxSteps: 6, memory: { resource: 'r1', thread: 't1' } });
    const initial = await collect(stream);
    const suspended = initial.find(c => c.type === 'tool-call-suspended');
    expect(suspended?.payload.toolCallId).toBe('sup-tc');

    const resumed = await sup.resumeStream({ answer: 'blue' }, { runId: stream.runId, toolCallId: 'sup-tc' });
    const chunks = await collect(resumed);

    const acks = chunks.filter(c => c.type === 'tool-call-resumed');
    expect(acks.map(c => c.payload.toolCallId)).toEqual(['sup-tc']);
    const ackIndex = chunks.indexOf(acks[0]);
    const resultIndex = chunks.findIndex(c => c.type === 'tool-result' && c.payload.toolCallId === 'sup-tc');
    expect(resultIndex).toBeGreaterThan(ackIndex);
    expect(chunks.some(c => c.type === 'tool-call-suspended')).toBe(false);
    expect(resumed.status).not.toBe('suspended');
  });

  it('does not emit tool-call-resumed for a fresh call whose model args carry resumeData', async () => {
    const agent = buildAgentCallingTool(
      'asker-fresh',
      'tc-fresh',
      'askUser',
      { question: 'color?', resumeData: { answer: 'red' } },
      { tools: { askUser: buildAskUserTool() } },
    );
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

    const chunks = await collect(await agent.stream('ask', { maxSteps: 3 }));
    expect(chunks.some(c => c.type === 'tool-result' && c.payload.toolCallId === 'tc-fresh')).toBe(true);
    expect(chunks.some(c => c.type === 'tool-call-resumed')).toBe(false);
  });

  it('emits an approval tool-call-resumed when an approval-gated call is approved', async () => {
    const agent = buildAgentCallingTool(
      'approver',
      'tc-appr',
      'doThing',
      { value: 'x' },
      {
        tools: {
          doThing: createTool({
            id: 'do-thing',
            description: 'Does a thing.',
            inputSchema: z.object({ value: z.string() }),
            requireApproval: true,
            execute: async (input: { value: string }) => ({ done: input.value }),
          }),
        },
      },
    );
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

    const stream = await agent.stream('go', { maxSteps: 3 });
    const initial = await collect(stream);
    expect(initial.some(c => c.type === 'tool-call-approval')).toBe(true);

    const chunks = await collect(await agent.approveToolCall({ runId: stream.runId, toolCallId: 'tc-appr' }));
    const acks = chunks.filter(c => c.type === 'tool-call-resumed');
    expect(acks).toHaveLength(1);
    expect(acks[0].payload).toMatchObject({ toolCallId: 'tc-appr', kind: 'approval', args: { value: 'x' } });
    const resultIndex = chunks.findIndex(c => c.type === 'tool-result' && c.payload.toolCallId === 'tc-appr');
    expect(resultIndex).toBeGreaterThan(chunks.indexOf(acks[0]));
  });

  it('acks the originally suspended delegation id when auto-resume re-calls it under a new id', async () => {
    const subAgent = buildAgentCallingTool(
      'sub-agent',
      'inner-tc',
      'askUser',
      { question: 'color?' },
      { tools: { askUser: buildAskUserTool() } },
    );
    let step = 0;
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'Delegate.',
      model: new MockLanguageModelV2({
        doStream: async () => {
          step += 1;
          if (step === 1) {
            return streamOf('s-1', [
              { type: 'tool-call', toolCallId: 'sup-tc', toolName: 'agent-subAgent', input: '{"prompt":"ask"}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]);
          }
          if (step === 2) {
            return streamOf('s-2', [
              {
                type: 'tool-call',
                toolCallId: 'sup-tc-2',
                toolName: 'agent-subAgent',
                input: '{"prompt":"ask","suspendedToolCallId":"sup-tc","resumeData":{"answer":"blue"}}',
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]);
          }
          return streamOf(`s-${step}`, text('s-t', 'done'));
        },
      }),
      agents: { subAgent },
      memory: new MockMemory(),
      defaultOptions: { autoResumeSuspendedTools: true },
    });
    const mastra = new Mastra({ agents: { supervisor }, logger: false, storage: new InMemoryStore() });
    const sup = mastra.getAgent('supervisor');
    const memory = { resource: 'r-auto', thread: 't-auto' };

    const first = await collect(await sup.stream('go', { maxSteps: 6, memory }));
    expect(first.find(c => c.type === 'tool-call-suspended')?.payload.toolCallId).toBe('sup-tc');

    const second = await collect(await sup.stream('blue', { maxSteps: 6, memory }));
    const acks = second.filter(c => c.type === 'tool-call-resumed');
    expect(
      acks.map(c => c.payload.toolCallId),
      second.map(c => c.type).join(','),
    ).toEqual(['sup-tc']);
  });
});
