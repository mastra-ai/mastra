import net from 'node:net';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../../request-context';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function textModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text' },
        { type: 'text-delta', id: 'text', delta: text },
        { type: 'text-end', id: 'text' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

describe('DurableAgent constructor model resolution', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('No network in constructor tests');
    });
    vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(() => {
      throw new Error('No sockets in constructor tests');
    });
  });

  afterEach(() => {
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(net.Socket.prototype.connect).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it.each(['synchronous', 'asynchronous'] as const)(
    'defers an unavailable %s model and preserves its awaited rejection',
    async kind => {
      const unavailable = new Error('No model is currently available');
      const resolver = vi.fn(() => {
        if (kind === 'asynchronous') return Promise.reject(unavailable);
        throw unavailable;
      });
      const agent = new Agent({
        id: 'unavailable-model',
        name: 'Unavailable model',
        instructions: 'Test',
        model: resolver,
      });
      const durable = createDurableAgent({ agent });

      // Let an eagerly created rejection surface rather than hiding it in a constructor assertion.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(resolver).not.toHaveBeenCalled();
      await expect(durable.getModel()).rejects.toBe(unavailable);
      expect(resolver).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves a static model without resolving it during construction', async () => {
    const model = textModel('Static response');
    const agent = new Agent({ id: 'static-model', name: 'Static model', instructions: 'Test', model });
    const getModel = vi.spyOn(agent, 'getModel');
    const durable = createDurableAgent({ agent });

    expect(getModel).not.toHaveBeenCalled();
    expect(await durable.getModel()).toMatchObject({ modelId: model.modelId, provider: model.provider });
    const { output, cleanup } = await durable.stream('Hello', { maxSteps: 1 });
    try {
      expect(await output.text).toBe('Static response');
    } finally {
      cleanup();
    }
  });

  it('resolves the current request context during each durable execution', async () => {
    const firstModel = textModel('First response');
    const secondModel = textModel('Second response');
    const selected: string[] = [];
    const resolver = vi.fn(({ requestContext }: { requestContext: RequestContext }) => {
      const selection = requestContext.get('selection');
      if (selection !== 'first' && selection !== 'second') throw new Error('A request selection is required');
      selected.push(selection);
      return selection === 'first' ? firstModel : secondModel;
    });
    const agent = new Agent({ id: 'request-model', name: 'Request model', instructions: 'Test', model: resolver });
    const durable = createDurableAgent({ agent });
    expect(resolver).not.toHaveBeenCalled();

    for (const [selection, expected] of [
      ['first', 'First response'],
      ['second', 'Second response'],
    ]) {
      const requestContext = new RequestContext();
      requestContext.set('selection', selection);
      const { output, cleanup } = await durable.stream('Hello', { requestContext, maxSteps: 1 });
      try {
        expect(await output.text).toBe(expected);
      } finally {
        cleanup();
      }
    }
    expect(selected).toContain('first');
    expect(selected).toContain('second');
  });
});
