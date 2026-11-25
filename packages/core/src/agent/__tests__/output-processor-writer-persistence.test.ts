import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import type { MastraDBMessage } from '../../memory/types';
import type { OutputProcessor } from '../../processors/index';
import { Agent } from '../index';

const model = () =>
  new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'DONE' },
        { type: 'text-end', id: 't1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
  });

type Order = 'copy-then-write' | 'write-then-copy';

async function savedAssistantParts(processor: OutputProcessor, thread: string) {
  const memory = new MockMemory();
  const agent = new Agent({
    id: 'writer-persistence',
    name: 'writer-persistence',
    instructions: 'x',
    model: model(),
    memory,
    outputProcessors: [processor],
  });
  const stream = await agent.stream('hi', { memory: { thread, resource: 'r' } });
  const streamed: string[] = [];
  for await (const chunk of stream.fullStream) {
    if (chunk.type.startsWith('data-')) streamed.push(chunk.type);
  }
  const { messages } = await memory.recall({ threadId: thread, resourceId: 'r' });
  const saved = messages.filter(m => m.role === 'assistant').flatMap(m => m.content.parts.map(p => p.type));
  return { streamed, saved };
}

async function writeAndReturnCopies(
  messages: MastraDBMessage[],
  writer: { custom: (data: { type: string; data?: unknown }) => Promise<void> } | undefined,
  order: Order,
  type: string,
) {
  let copies = order === 'copy-then-write' ? structuredClone(messages) : undefined;
  await writer?.custom({ type, data: { ok: true } });
  copies ??= structuredClone(messages);
  return copies;
}

describe('output processor writer.custom() parts survive a returned message array (#29822)', () => {
  for (const order of ['copy-then-write', 'write-then-copy'] as const) {
    it(`processOutputResult keeps the data part in saved history (${order})`, async () => {
      const processor: OutputProcessor = {
        id: 'result-probe',
        processOutputResult: ({ messages, writer }) =>
          writeAndReturnCopies(messages, writer, order, 'data-result-probe'),
      };
      const { streamed, saved } = await savedAssistantParts(processor, `result-${order}`);
      expect(streamed).toEqual(['data-result-probe']);
      expect(saved.filter(t => t === 'data-result-probe')).toHaveLength(1);
      expect(saved).toContain('text');
    });

    it(`processOutputStep keeps the data part in saved history (${order})`, async () => {
      const processor: OutputProcessor = {
        id: 'step-probe',
        processOutputStep: ({ messages, writer }) => writeAndReturnCopies(messages, writer, order, 'data-step-probe'),
      };
      const { streamed, saved } = await savedAssistantParts(processor, `step-${order}`);
      expect(streamed).toEqual(['data-step-probe']);
      expect(saved.filter(t => t === 'data-step-probe')).toHaveLength(1);
      expect(saved).toContain('text');
    });
  }

  it('a processor can still drop a data part that existed before it ran', async () => {
    const writerProcessor: OutputProcessor = {
      id: 'writes-early',
      processOutputResult: async ({ messageList, writer }) => {
        await writer?.custom({ type: 'data-stale', data: { ok: false } });
        return messageList;
      },
    };
    const dropper: OutputProcessor = {
      id: 'drops-stale',
      processOutputResult: ({ messages }) =>
        messages.map(m => ({
          ...m,
          content: { ...m.content, parts: m.content.parts.filter(p => p.type !== 'data-stale') },
        })),
    };
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'drop',
      name: 'drop',
      instructions: 'x',
      model: model(),
      memory,
      outputProcessors: [writerProcessor, dropper],
    });
    const stream = await agent.stream('hi', { memory: { thread: 'drop', resource: 'r' } });
    await stream.consumeStream();
    const { messages } = await memory.recall({ threadId: 'drop', resourceId: 'r' });
    const saved = messages.filter(m => m.role === 'assistant').flatMap(m => m.content.parts.map(p => p.type));
    expect(saved).not.toContain('data-stale');
    expect(saved).toContain('text');
  });
});
