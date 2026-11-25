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

  for (const returns of ['messageList', 'copies'] as const) {
    it(`a second write with the same id is kept the same way whether the processor returns ${returns}`, async () => {
      const first: OutputProcessor = {
        id: 'writes-v1',
        processOutputResult: async ({ messageList, writer }) => {
          await writer?.custom({ type: 'data-progress', id: 'p', data: { v: 1 } } as { type: string; data: unknown });
          return messageList;
        },
      };
      const second: OutputProcessor = {
        id: 'writes-v2',
        processOutputResult: async ({ messages, messageList, writer }) => {
          const copies = structuredClone(messages);
          await writer?.custom({ type: 'data-progress', id: 'p', data: { v: 2 } } as { type: string; data: unknown });
          return returns === 'copies' ? copies : messageList;
        },
      };
      const memory = new MockMemory();
      const agent = new Agent({
        id: 'rewrite',
        name: 'rewrite',
        instructions: 'x',
        model: model(),
        memory,
        outputProcessors: [first, second],
      });
      const stream = await agent.stream('hi', { memory: { thread: `rewrite-${returns}`, resource: 'r' } });
      await stream.consumeStream();
      const { messages } = await memory.recall({ threadId: `rewrite-${returns}`, resourceId: 'r' });
      const progress = messages
        .filter(m => m.role === 'assistant')
        .flatMap(m => m.content.parts)
        .filter(p => p.type === 'data-progress')
        .map(p => (p as { data: unknown }).data);
      expect(progress).toEqual([{ v: 1 }, { v: 2 }]);
    });
  }

  type Phase = 'processOutputResult' | 'processOutputStep';
  type Part = { type: string; id?: string; data?: unknown };

  async function savedData(phase: Phase, thread: string, run: OutputProcessor['processOutputResult']) {
    const processor = { id: `combo-${thread}`, [phase]: run } as OutputProcessor;
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'combo',
      name: 'combo',
      instructions: 'x',
      model: model(),
      memory,
      outputProcessors: [processor],
    });
    const stream = await agent.stream('hi', { memory: { thread, resource: 'r' } });
    await stream.consumeStream();
    const { messages } = await memory.recall({ threadId: thread, resourceId: 'r' });
    return messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => m.content.parts as Part[])
      .filter(p => p.type === 'data-e')
      .map(p => ({ ...(p.id ? { id: p.id } : {}), data: p.data }));
  }

  const dataParts = (message: MastraDBMessage) => message.content.parts as Part[];
  const lastAssistant = (copies: MastraDBMessage[]) => copies.findLast(m => m.role === 'assistant')!;

  for (const phase of ['processOutputResult', 'processOutputStep'] as const) {
    it(`${phase}: write, copy, edit the written part in the copy saves only the edited part`, async () => {
      const saved = await savedData(phase, `edit-${phase}`, async ({ messages, writer }) => {
        await writer?.custom({ type: 'data-e', data: { v: 1 } });
        const copies = structuredClone(messages);
        dataParts(lastAssistant(copies)).find(p => p.type === 'data-e')!.data = { v: 2 };
        return copies;
      });
      expect(saved).toEqual([{ data: { v: 2 } }]);
    });

    // The step-phase writer does not store part ids (separate from #29822), so ids are covered in the result phase.
    for (const withIds of phase === 'processOutputResult' ? [false, true] : [false]) {
      const ids = withIds ? ['a', 'b'] : [undefined, undefined];
      const label = withIds ? 'with ids' : 'without ids';

      it(`${phase}: two writes of one type ${label}, copied after, are both saved once`, async () => {
        const saved = await savedData(phase, `two-${phase}-${withIds}`, async ({ messages, writer }) => {
          for (const [i, id] of ids.entries()) {
            await writer?.custom({ type: 'data-e', ...(id ? { id } : {}), data: { v: i } } as Part);
          }
          return structuredClone(messages);
        });
        expect(saved).toEqual(ids.map((id, i) => ({ ...(id ? { id } : {}), data: { v: i } })));
      });

      it(`${phase}: two writes of one type ${label}, one edited in the copy, saves the edit and the other`, async () => {
        const saved = await savedData(phase, `two-edit-${phase}-${withIds}`, async ({ messages, writer }) => {
          for (const [i, id] of ids.entries()) {
            await writer?.custom({ type: 'data-e', ...(id ? { id } : {}), data: { v: i } } as Part);
          }
          const copies = structuredClone(messages);
          dataParts(lastAssistant(copies)).filter(p => p.type === 'data-e')[1]!.data = { v: 'edited' };
          return copies;
        });
        expect(saved).toEqual([
          { ...(ids[0] ? { id: ids[0] } : {}), data: { v: 0 } },
          { ...(ids[1] ? { id: ids[1] } : {}), data: { v: 'edited' } },
        ]);
      });

      it(`${phase}: copy taken between two writes ${label} keeps both`, async () => {
        const saved = await savedData(phase, `between-${phase}-${withIds}`, async ({ messages, writer }) => {
          await writer?.custom({ type: 'data-e', ...(ids[0] ? { id: ids[0] } : {}), data: { v: 0 } } as Part);
          const copies = structuredClone(messages);
          await writer?.custom({ type: 'data-e', ...(ids[1] ? { id: ids[1] } : {}), data: { v: 1 } } as Part);
          return copies;
        });
        expect(saved).toEqual(ids.map((id, i) => ({ ...(id ? { id } : {}), data: { v: i } })));
      });
    }
  }
});
