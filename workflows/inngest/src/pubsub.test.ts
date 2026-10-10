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

  it('keeps a finish under the cap even when stepResult alone is oversized', async () => {
    const { pubsub, published } = setup();
    await pubsub.publish('agent.stream.r1', {
      type: 'finish',
      runId: 'r1',
      data: { stepResult: { reason: 'stop', blob: huge }, output: { text: 'done', steps: [] } },
    });
    expect(published).toEqual([
      { type: 'finish', runId: 'r1', data: { stepResult: { reason: 'stop' }, output: { steps: [] } } },
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
});
