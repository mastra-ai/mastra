import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import type { ChunkType } from '../stream';
import { REPROCESS_PART_KEY } from './index';
import type { ProcessOutputStreamArgs, Processor } from './index';

/** The example from the processor interface reference: adds a sign-off before the reply's text closes. */
class SignOff implements Processor<'sign-off'> {
  readonly id = 'sign-off';

  async processOutputStream({ part, state }: ProcessOutputStreamArgs): Promise<ChunkType> {
    if (part.type !== 'text-end' || state.signed) return part;
    state.signed = true;
    state[REPROCESS_PART_KEY] = part;
    return { ...part, type: 'text-delta', payload: { id: part.payload.id, text: '\n\nCheers!' } };
  }
}

/** Records the parts that reach it, to show the stashed part also goes to processors after the one that stashed it. */
class Recorder implements Processor<'recorder'> {
  readonly id = 'recorder';
  readonly seen: string[] = [];

  async processOutputStream({ part }: ProcessOutputStreamArgs) {
    if (part.type === 'text-delta') this.seen.push(`text-delta:${part.payload.text}`);
    else if (part.type === 'text-end') this.seen.push('text-end');
    return part;
  }
}

const model = () =>
  new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'See you there.' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ]),
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
  });

describe('REPROCESS_PART_KEY', () => {
  it('lets an output processor emit a second part right after the one it returns', async () => {
    const memory = new MockMemory();
    const recorder = new Recorder();
    const agent = new Agent({
      id: 'sign-off-agent',
      name: 'Sign-off agent',
      instructions: 'Reply briefly.',
      model: model() as any,
      memory,
      outputProcessors: [new SignOff(), recorder],
    });

    const stream = await agent.stream('Lunch at noon?', { memory: { thread: 'thread-1', resource: 'user-1' } });
    const streamed: string[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'text-delta') streamed.push(`text-delta:${chunk.payload.text}`);
      else if (chunk.type === 'text-end') streamed.push('text-end');
    }

    const expected = ['text-delta:See you there.', 'text-delta:\n\nCheers!', 'text-end'];
    expect(streamed).toEqual(expected);
    expect(recorder.seen).toEqual(expected);

    const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'user-1' });
    const reply = messages.find(message => message.role === 'assistant');
    const text = reply?.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])).join('');
    expect(text).toBe('See you there.\n\nCheers!');
  });
});
