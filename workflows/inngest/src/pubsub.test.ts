import { createDurableAgentStream } from '@mastra/core/agent/durable';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscribeMock = vi.hoisted(() => vi.fn());
vi.mock('inngest/realtime', () => ({ subscribe: subscribeMock }));

import { InngestPubSub, OVERSIZED_EVENT_CHUNK_TYPE } from './pubsub';

function setup() {
  const published: unknown[] = [];
  const inngest = {
    realtime: {
      publish: vi.fn(async (_ref: unknown, data: unknown) => {
        published.push(data);
      }),
    },
  };
  return { pubsub: new InngestPubSub(inngest as any, 'wf'), published, inngest };
}

const huge = 'x'.repeat(700_000);

describe('InngestPubSub Realtime size cap (#20671)', () => {
  beforeEach(() => {
    subscribeMock.mockReset();
  });

  it('publishes agent events under the cap unchanged', async () => {
    const { pubsub, published } = setup();
    const event = { type: 'finish', runId: 'r1', data: { output: { text: 'hi', steps: [{ text: 'hi' }] } } };
    await pubsub.publish('agent.stream.r1', event);
    expect(published).toEqual([event]);
  });

  it('reduces an oversized finish to the fields stream consumers read', async () => {
    const { pubsub, published } = setup();
    await pubsub.publish('agent.stream.r1', {
      type: 'finish',
      runId: 'r1',
      data: {
        stepResult: { reason: 'stop' },
        output: { text: 'done', usage: { totalTokens: 3 }, steps: [{ toolResults: [{ result: huge }] }] },
      },
    });
    expect(published).toEqual([
      {
        type: 'finish',
        runId: 'r1',
        data: { stepResult: { reason: 'stop' }, output: { text: 'done', usage: { totalTokens: 3 }, steps: [] } },
      },
    ]);
  });

  it('keeps the final text when stepResult alone is oversized', async () => {
    const { pubsub, published } = setup();
    await pubsub.publish('agent.stream.r1', {
      type: 'finish',
      runId: 'r1',
      data: {
        stepResult: { reason: 'stop', blob: huge },
        output: { text: 'done', usage: { totalTokens: 3 }, steps: [] },
      },
    });
    expect(published).toEqual([
      {
        type: 'finish',
        runId: 'r1',
        data: { stepResult: { reason: 'stop' }, output: { steps: [], text: 'done', usage: { totalTokens: 3 } } },
      },
    ]);
  });

  it('replaces an oversized non-terminal event with a placeholder chunk and logs a warning', async () => {
    const { pubsub, published } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await pubsub.publish('agent.stream.r1', {
      type: 'chunk',
      runId: 'r1',
      data: { type: 'tool-result', payload: { result: huge } },
    });
    expect(published).toEqual([
      {
        type: 'chunk',
        runId: 'r1',
        data: {
          type: OVERSIZED_EVENT_CHUNK_TYPE,
          transient: true,
          data: { eventType: 'chunk', chunkType: 'tool-result', bytes: expect.any(Number), limit: 480 * 1024 },
        },
      },
    ]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('uses the provided logger instead of the console', async () => {
    const logger = { warn: vi.fn() };
    const inngest = { realtime: { publish: vi.fn(async () => {}) } };
    const pubsub = new InngestPubSub(inngest as any, 'wf', logger as any);
    await pubsub.publish('agent.stream.r1', { type: 'step-start', runId: 'r1', data: { request: huge } });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('step-start'));
  });

  it('salvages a truncated terminal message and turns a truncated non-terminal one into a placeholder', async () => {
    let onMessage: (m: unknown) => void = () => {};
    subscribeMock.mockImplementation(async (opts: { onMessage: (m: unknown) => void }) => {
      onMessage = opts.onMessage;
      return { close: vi.fn() };
    });
    const { pubsub } = setup();
    const received: any[] = [];
    await pubsub.subscribe('agent.stream.r1', event => received.push(event));

    onMessage({ data: '{"type":"chunk","runId":"r1","data":{"type":"tool-result","payload":{"result":"xxxx' });
    onMessage({ data: '{"type":"finish","runId":"r1","data":{"stepResult":{"reason":"stop"},"output":{"steps":[{"te' });

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({
      type: 'chunk',
      data: { type: OVERSIZED_EVENT_CHUNK_TYPE, data: { eventType: 'chunk', chunkType: 'tool-result' } },
    });
    expect(received[1]).toMatchObject({
      type: 'finish',
      runId: 'r1',
      data: { output: { steps: [] }, stepResult: { reason: 'stop' } },
    });
  });

  it('keeps an oversized error readable so the stream can close with onError', async () => {
    const { pubsub, published } = setup();
    await pubsub.publish('agent.stream.r1', {
      type: 'error',
      runId: 'r1',
      data: { error: { name: 'ProviderError', message: huge, stack: huge } },
    });
    const sent = published[0] as any;
    expect(sent.data.error.name).toBe('ProviderError');
    expect(typeof sent.data.error.message).toBe('string');
    expect(sent.data.error.stack).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(sent))).toBeLessThan(480 * 1024);
  });

  it('salvages a truncated error into an envelope with error.message', async () => {
    let onMessage: (m: unknown) => void = () => {};
    subscribeMock.mockImplementation(async (opts: { onMessage: (m: unknown) => void }) => {
      onMessage = opts.onMessage;
      return { close: vi.fn() };
    });
    const { pubsub } = setup();
    const received: any[] = [];
    await pubsub.subscribe('agent.stream.r1', event => received.push(event));
    onMessage({ data: '{"type":"error","runId":"r1","data":{"error":{"name":"E","message":"xxxx' });
    expect(received[0]).toMatchObject({ type: 'error', runId: 'r1', data: { error: { name: 'Error' } } });
    expect(typeof received[0].data.error.message).toBe('string');
  });

  it.each([
    ['oversized', (sent: unknown) => sent],
    ['truncated by Realtime', (sent: unknown) => JSON.stringify(sent).slice(0, 200)],
  ])('closes an attached stream and fires onError for an %s error', async (_label, deliver) => {
    let onMessage: (m: unknown) => void = () => {};
    subscribeMock.mockImplementation(async (opts: { onMessage: (m: unknown) => void }) => {
      onMessage = opts.onMessage;
      return { close: vi.fn() };
    });
    const { pubsub, published } = setup();
    const onError = vi.fn();
    const { output, ready, cleanup } = createDurableAgentStream({
      pubsub,
      runId: 'r1',
      messageId: 'm1',
      model: { modelId: 'm', provider: 'p', version: 'v3' },
      onError,
    });
    await ready;

    const event = { type: 'error', runId: 'r1', data: { error: { name: 'ProviderError', message: huge } } };
    await pubsub.publish('agent.stream.r1', event);
    // Without a reduced envelope Realtime would deliver the full event cut off as a string.
    onMessage({ data: deliver(published[0]) });

    const chunks: any[] = [];
    for await (const chunk of output.fullStream) chunks.push(chunk);
    cleanup();
    expect(chunks.some(c => c.type === 'error')).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
