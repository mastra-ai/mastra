/**
 * When an output processor aborts in `processOutputResult`, `stream()` must end with a `tripwire`
 * chunk (and no `finish` chunk), the same as every other tripwire and the durable agent.
 * https://github.com/mastra-ai/mastra/issues/27170
 */
import { describe, expect, it, vi } from 'vitest';
import type { Processor } from '../../processors';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

function textModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'r-1', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 't-1' },
        { type: 'text-delta', id: 't-1', delta: text },
        { type: 'text-end', id: 't-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

const gate: Processor = {
  id: 'gate',
  processOutputResult: async ({ abort }) => abort('rejected by the gate'),
};

function createAgent(outputProcessors: Processor[] = [gate]) {
  return new Agent({
    id: 'gated-agent',
    name: 'gated-agent',
    instructions: 'Reply.',
    model: textModel('hello'),
    outputProcessors,
  });
}

describe('processOutputResult tripwire on stream()', () => {
  it('ends fullStream with a tripwire chunk instead of finish', async () => {
    const onFinish = vi.fn();
    const result = await createAgent().stream('hi', { onFinish });

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }
    const types = chunks.map(chunk => chunk.type);

    expect(types).not.toContain('finish');
    expect(types.at(-1)).toBe('tripwire');
    expect(types.filter(type => type === 'tripwire')).toHaveLength(1);
    expect(chunks.at(-1).payload).toMatchObject({ reason: 'rejected by the gate', processorId: 'gate' });

    expect(await result.tripwire).toMatchObject({ reason: 'rejected by the gate', processorId: 'gate' });
    expect(await result.finishReason).toBe('other');
    expect(result.status).toBe('tripwire');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('still ends with finish when no processor aborts', async () => {
    const result = await createAgent([]).stream('hi');

    const types: string[] = [];
    for await (const chunk of result.fullStream) {
      types.push(chunk.type);
    }

    expect(types.at(-1)).toBe('finish');
    expect(types).not.toContain('tripwire');
    expect(result.status).toBe('success');
  });

  it('keeps reporting the tripwire from generate()', async () => {
    const result = await createAgent().generate('hi');

    expect(result.tripwire).toMatchObject({ reason: 'rejected by the gate', processorId: 'gate' });
    expect(result.finishReason).toBe('other');
  });
});
