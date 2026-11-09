import { convertArrayToReadableStream, MockLanguageModelV3 } from '@internal/ai-v6/test';
import { describe, expect, it, vi } from 'vitest';
import type { Processor } from '../../processors';
import { Agent } from '../agent';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function model() {
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'hello ' },
        { type: 'text-delta', id: 't', delta: 'blocked' },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
      ]),
    }),
  });
}

const blockOnWord: Processor = {
  id: 'block-on-word',
  processOutputStream: async ({ part, abort }) => {
    if (part.type === 'text-delta' && part.payload.text.includes('blocked')) abort('not allowed');
    return part;
  },
};

describe('agent.stream() output processor tripwire', () => {
  it('still calls onFinish when an output processor aborts the stream', async () => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model: model(),
      outputProcessors: [blockOnWord],
    });
    const onFinish = vi.fn();

    const stream = await agent.stream('hi', { onFinish });
    await stream.consumeStream();

    expect((await stream.tripwire)?.reason).toBe('not allowed');
    await vi.waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ finishReason: 'other', tripwire: { reason: 'not allowed' } });
  });
  it('delivers the tripwire chunk to a fullStream reader that attaches while onFinish is pending', async () => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model: model(),
      outputProcessors: [blockOnWord],
    });
    const events: string[] = [];
    let releaseOnFinish!: () => void;
    const onFinishGate = new Promise<void>(resolve => {
      releaseOnFinish = resolve;
    });
    let onFinishStarted!: () => void;
    const onFinishRunning = new Promise<void>(resolve => {
      onFinishStarted = resolve;
    });
    const onFinish = vi.fn(async () => {
      events.push('onFinish');
      onFinishStarted();
      await onFinishGate;
    });

    const stream = await agent.stream('hi', { onFinish });
    await stream.finishReason;
    await onFinishRunning;

    // Attach the reader only after finishReason resolved and while onFinish is still held open.
    const reading = (async () => {
      const types: string[] = [];
      for await (const chunk of stream.fullStream) {
        types.push(chunk.type);
        if (chunk.type === 'tripwire') events.push('tripwire');
      }
      events.push('closed');
      return types;
    })();

    releaseOnFinish();
    const types = await reading;

    expect(types).toContain('tripwire');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(events.indexOf('onFinish')).toBeLessThan(events.indexOf('closed'));
    expect(events.indexOf('tripwire')).toBeLessThan(events.indexOf('closed'));
  });
});
