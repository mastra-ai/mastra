import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { ConsoleLogger } from '../../logger';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Regression tests for #22217: delegated (supervisor) resume dropped sub-agent
 * leaf-tool writer.custom() frames from the parent stream.
 *
 * Root cause: the delegation tool generated a fresh sub-agent thread id on every
 * execution — including resume — so the resumed run tagged new data-* frames with
 * a thread that didn't match the snapshot-restored messageList, which threw on
 * persistence and dropped the frames before they reached the parent stream.
 */

const ORDER = 'ord_AAA';

function buildLeafTool() {
  return createTool({
    id: 'process-order',
    description: 'Process the given order. Requires human approval.',
    inputSchema: z.object({ orderId: z.string() }),
    outputSchema: z.object({ orderId: z.string(), processed: z.boolean() }),
    requireApproval: true,
    execute: async (input: { orderId: string }, context: any) => {
      await context?.writer?.custom({
        type: 'data-progress',
        data: { orderId: input.orderId, step: 1 },
      });
      return { orderId: input.orderId, processed: true };
    },
  });
}

function buildSubAgentModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const text = JSON.stringify(prompt);
      const hasToolResult = text.includes('"processed"');
      const chunks = hasToolResult
        ? [
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: `Processed ${ORDER}.` },
            { type: 'text-end', id: 't1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            {
              type: 'tool-call',
              toolCallId: 'tc-1',
              toolName: 'process-order',
              input: JSON.stringify({ orderId: ORDER }),
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sub-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });
}

function buildSubAgent() {
  return new Agent({
    id: 'sub-agent',
    name: 'Sub Agent',
    description: 'Processes a single order.',
    instructions: 'Process the order by calling process-order.',
    model: buildSubAgentModel(),
    tools: { processOrderTool: buildLeafTool() },
  });
}

function buildSupervisor(subAgent: Agent) {
  let step = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      step += 1;
      const chunks =
        step === 1
          ? [
              {
                type: 'tool-call',
                toolCallId: 'sup-tc-A',
                toolName: 'agent-subAgent',
                input: JSON.stringify({ prompt: `Process order ${ORDER}.`, maxSteps: 3 }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 'sf' },
              { type: 'text-delta', id: 'sf', delta: 'Done.' },
              { type: 'text-end', id: 'sf' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `sup-${step}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'Delegate to the sub agent.',
    model,
    agents: { subAgent },
    memory: new MockMemory(),
  });
}

async function collectChunks(stream: any): Promise<any[]> {
  const chunks: any[] = [];
  for await (const chunk of stream.fullStream) chunks.push(chunk);
  return chunks;
}

function expectNoErrors(chunks: any[]) {
  const errorChunks = chunks.filter(c => c.type === 'tool-error' || c.type === 'error');
  expect(errorChunks).toEqual([]);
}

describe('delegated resume custom frames (#22217)', () => {
  it('direct (non-delegated) resume emits data-progress custom frames', async () => {
    const agent = buildSubAgent();
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

    const stream = await agent.stream(`Process order ${ORDER}.`, { maxSteps: 3 });
    const initialChunks = await collectChunks(stream);
    expect(initialChunks.some(c => c.type === 'tool-call-approval')).toBe(true);

    const resumed = await agent.resumeStream({ approved: true }, { runId: stream.runId });
    const resumedChunks = await collectChunks(resumed);
    expectNoErrors(resumedChunks);
    expect(resumedChunks.map(c => c.type)).toContain('data-progress');
  });

  it('delegated resume via approveToolCall emits data-progress custom frames on the parent stream', async () => {
    // Spy on warn logs: if the resumed delegation regresses to a fresh sub-agent
    // thread id, the data-* persistence fallback warns instead of throwing, which
    // would otherwise mask the identity bug in this test.
    const warnings: string[] = [];
    class WarnSpyLogger extends ConsoleLogger {
      override warn(message: string) {
        warnings.push(message);
      }
    }
    const sup = buildSupervisor(buildSubAgent());
    const mastra = new Mastra({
      agents: { supervisor: sup },
      logger: new WarnSpyLogger({ level: 'warn' }),
      storage: new InMemoryStore(),
    });
    const supervisor = mastra.getAgent('supervisor');

    const stream = await supervisor.stream('Process the order.', {
      maxSteps: 6,
      memory: { resource: 'r1', thread: 'thread-1' },
    });
    const initialChunks = await collectChunks(stream);
    expect(initialChunks.some(c => c.type === 'tool-call-approval')).toBe(true);

    const resumed = await supervisor.approveToolCall({ runId: stream.runId, toolCallId: 'sup-tc-A' });
    const resumedChunks = await collectChunks(resumed);
    expectNoErrors(resumedChunks);
    const types = resumedChunks.map(c => c.type);
    expect(types).toContain('tool-result');
    expect(types).toContain('data-progress');
    expect(warnings.filter(w => w.includes('Failed to persist data chunk'))).toEqual([]);
  });

  it('delegated resume via resumeStream emits data-progress custom frames on the parent stream', async () => {
    const sup = buildSupervisor(buildSubAgent());
    const mastra = new Mastra({ agents: { supervisor: sup }, logger: false, storage: new InMemoryStore() });
    const supervisor = mastra.getAgent('supervisor');

    const stream = await supervisor.stream('Process the order.', {
      maxSteps: 6,
      memory: { resource: 'r1', thread: 'thread-1' },
    });
    const initialChunks = await collectChunks(stream);
    expect(initialChunks.some(c => c.type === 'tool-call-approval')).toBe(true);

    const resumed = await supervisor.resumeStream({ approved: true }, { runId: stream.runId, toolCallId: 'sup-tc-A' });
    const resumedChunks = await collectChunks(resumed);
    expectNoErrors(resumedChunks);
    const types = resumedChunks.map(c => c.type);
    expect(types).toContain('tool-result');
    expect(types).toContain('data-progress');
  });

  it('a data-* persistence failure does not drop the frame from the stream', async () => {
    const agent = buildSubAgent();
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

    const stream = await agent.stream(`Process order ${ORDER}.`, { maxSteps: 3 });
    await collectChunks(stream);

    const resumed = await agent.resumeStream({ approved: true }, { runId: stream.runId });
    // Force the persistence step to fail for data-* parts while the run streams.
    const messageList = (resumed as any).messageList;
    const originalAdd = messageList.add.bind(messageList);
    messageList.add = (message: any, tag: any) => {
      const parts = Array.isArray(message?.content?.parts) ? message.content.parts : [];
      if (parts.some((part: any) => typeof part?.type === 'string' && part.type.startsWith('data-'))) {
        throw new Error('simulated persistence failure');
      }
      return originalAdd(message, tag);
    };

    const resumedChunks = await collectChunks(resumed);
    expectNoErrors(resumedChunks);
    expect(resumedChunks.map(c => c.type)).toContain('data-progress');
  });
});
