import { once } from 'node:events';
import { createServer } from 'node:http';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../../memory/src';
import { MastraError } from '../../error';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { ErrorProcessorOrWorkflow, InputProcessorOrWorkflow, Processor } from '../../processors';
import { PrefillErrorHandler } from '../../processors/prefill-error-handler';
import { ProviderHistoryCompat } from '../../processors/provider-history-compat';
import { StreamErrorRetryProcessor } from '../../processors/stream-error-retry-processor';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';

function makeModel(supported = false) {
  const prompts: LanguageModelV2Prompt[] = [];
  const model = new MockLanguageModelV2({
    supportedUrls: supported
      ? { 'image/*': [/^http:\/\/127\.0\.0\.1:/], 'application/pdf': [/^http:\/\/127\.0\.0\.1:/] }
      : {},
    doGenerate: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        content: [{ type: 'text', text: 'ok' }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text' },
          { type: 'text-delta', id: 'text', delta: 'ok' },
          { type: 'text-end', id: 'text' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
  return { model, prompts };
}

describe('attachment download recovery', () => {
  let server: ReturnType<typeof createServer>;
  let url: string;
  let failure: '404' | 'network' | undefined;
  let requests: number;
  const pubsubs: EventEmitterPubSub[] = [];

  beforeEach(async () => {
    requests = 0;
    failure = undefined;
    server = createServer((req, res) => {
      requests++;
      if (failure === 'network') {
        req.socket.destroy();
        return;
      }
      res.writeHead(failure ? 404 : 200, { 'Content-Type': 'application/pdf' });
      res.end(failure ? 'Not found' : Buffer.alloc(32, 1));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server port');
    url = `http://127.0.0.1:${address.port}/attachment?token=synthetic`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await Promise.all(pubsubs.splice(0).map(pubsub => pubsub.close()));
  });

  function setup({
    durable = false,
    errorProcessor,
    inputProcessor,
    models,
  }: {
    durable?: boolean;
    errorProcessor?: ErrorProcessorOrWorkflow;
    inputProcessor?: InputProcessorOrWorkflow;
    models?: MockLanguageModelV2[];
  } = {}) {
    const { model, prompts } = makeModel();
    const memory = new Memory({ storage: new InMemoryStore(), options: { lastMessages: 100, generateTitle: false } });
    const agent = new Agent({
      id: 'attachment-recovery',
      name: 'attachment-recovery',
      instructions: 'Answer ok.',
      model: (models ?? [model]).map(model => ({ model, maxRetries: 0 })),
      memory,
      inputProcessors: inputProcessor ? [inputProcessor] : [],
      // The agent adds the shared stability defaults unless their ids are present. These cases assert
      // what happens when the caller's processor is the only one deciding, so the list names all three
      // ids with neutral instances (no retry budget).
      errorProcessors: errorProcessor
        ? [
            errorProcessor,
            new ProviderHistoryCompat(),
            new StreamErrorRetryProcessor({ maxRetries: 0 }),
            new PrefillErrorHandler(),
          ]
        : [],
    });
    const pubsub = new EventEmitterPubSub();
    pubsubs.push(pubsub);
    const runner = durable ? createDurableAgent({ agent, pubsub }) : agent;
    async function run(message: Parameters<Agent['stream']>[0], maxProcessorRetries = 1, abortSignal?: AbortSignal) {
      const result = await runner.stream(message, {
        memory: { thread: 'thread', resource: 'resource' },
        maxSteps: 5,
        maxProcessorRetries,
        abortSignal,
      });
      let text = '';
      const errors: unknown[] = [];
      const chunks = [];
      try {
        for await (const chunk of result.fullStream) {
          chunks.push(chunk);
          if (chunk.type === 'text-delta') text += chunk.payload.text;
          if (chunk.type === 'error') errors.push(chunk.payload.error);
        }
      } finally {
        if ('cleanup' in result) await result.cleanup?.();
      }
      return { text, errors, chunks };
    }
    return { agent, run, prompts, memory };
  }

  function attachment(kind: 'image' | 'file' = 'file'): Parameters<Agent['stream']>[0] {
    return [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this attachment' },
          kind === 'image'
            ? { type: 'image', image: new URL(url) }
            : { type: 'file', data: new URL(url), mediaType: 'application/pdf' },
        ],
      },
    ];
  }

  async function waitForHistory(memory: Memory) {
    await vi.waitFor(async () => {
      expect(JSON.stringify((await memory.recall({ threadId: 'thread', resourceId: 'resource' })).messages)).toContain(
        url,
      );
    });
  }

  for (const durable of [false, true]) {
    for (const kind of ['image', 'file'] as const) {
      for (const unavailable of ['404', 'network'] as const) {
        it(`${durable ? 'durable' : 'regular'} recovers a historical ${kind} after ${unavailable}`, async () => {
          const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(
            ({ error, messages, messageList, retryCount }) => {
              expect(error).toBeInstanceOf(MastraError);
              expect(error).toMatchObject({ id: 'DOWNLOAD_ASSETS_FAILED', details: { url } });
              expect(retryCount).toBe(0);
              const affected = messages.filter(message => JSON.stringify(message).includes(url));
              expect(affected).toHaveLength(1);
              messageList.removeByIds(affected.map(message => message.id));
              return { retry: true };
            },
          );
          const processLLMRequest = vi.fn<NonNullable<Processor['processLLMRequest']>>(({ prompt }) => ({ prompt }));
          const { run, memory, prompts } = setup({
            durable,
            errorProcessor: { id: 'recover', processAPIError },
            inputProcessor: { id: 'request', processLLMRequest },
          });
          expect((await run(attachment(kind))).text).toBe('ok');
          await waitForHistory(memory);
          failure = unavailable;
          const recovered = await run('Continue');
          expect(recovered.text).toBe('ok');
          expect(recovered.errors).toEqual([]);
          expect(processAPIError).toHaveBeenCalledTimes(1);
          expect(processLLMRequest).toHaveBeenCalledTimes(2);
          expect(prompts).toHaveLength(2);
          expect(
            prompts[1]!
              .flatMap(message => (typeof message.content === 'string' ? [] : message.content))
              .filter(part => part.type === 'file'),
          ).toEqual([]);
          expect(requests).toBe(unavailable === 'network' ? 4 : 2);
          await waitForHistory(memory); // Repair is per-run; stored attachment history is not deleted.
        });
      }
    }
  }

  it.each([false, true])('fails closed with an error processor present: %s', async present => {
    const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(() => ({ retry: false }));
    const { run, memory, prompts } = setup({
      errorProcessor: present ? { id: 'decline', processAPIError } : undefined,
    });
    expect((await run(attachment())).text).toBe('ok');
    await waitForHistory(memory);
    failure = '404';
    for (let turn = 0; turn < 2; turn++) {
      const result = await run('Continue');
      expect(result.text).toBe('');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({ id: 'DOWNLOAD_ASSETS_FAILED', details: { url } });
      if (present) expect(result.errors[0]).toBe(processAPIError.mock.calls[turn]![0].error);
    }
    expect(processAPIError).toHaveBeenCalledTimes(present ? 2 : 0);
    expect(prompts).toHaveLength(1);
    expect(requests).toBe(3);
  });

  it.each([0, 2])('bounds unsuccessful processor retries to %i', async budget => {
    const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(() => ({ retry: true }));
    const { run, prompts } = setup({ errorProcessor: { id: 'retry-without-repair', processAPIError } });
    failure = '404';
    const result = await run(attachment(), budget);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe(processAPIError.mock.calls[budget]![0].error);
    expect(processAPIError.mock.calls.map(([args]) => args.retryCount)).toEqual(
      Array.from({ length: budget + 1 }, (_, i) => i),
    );
    expect(prompts).toHaveLength(0);
    expect(requests).toBe(budget + 1);
  });

  it('retries the same model before advancing to a fallback', async () => {
    const primary = makeModel();
    const fallback = makeModel(true);
    const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(({ messages, messageList }) => {
      messageList.removeByIds(
        messages.filter(message => JSON.stringify(message).includes(url)).map(message => message.id),
      );
      return { retry: true };
    });
    const { run } = setup({
      models: [primary.model, fallback.model],
      errorProcessor: { id: 'repair', processAPIError },
    });
    failure = '404';
    expect((await run(attachment())).text).toBe('ok');
    expect(processAPIError).toHaveBeenCalledTimes(1);
    expect(primary.prompts).toHaveLength(1);
    expect(fallback.prompts).toHaveLength(0);
    expect(requests).toBe(1);
  });

  it('preserves fallback to a model that supports the URL when recovery is declined', async () => {
    const primary = makeModel();
    const fallback = makeModel(true);
    const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(() => ({ retry: false }));
    const { run } = setup({
      models: [primary.model, fallback.model],
      errorProcessor: { id: 'decline', processAPIError },
    });
    failure = '404';
    const result = await run(attachment());
    expect(result.text).toBe('ok');
    expect(result.errors).toEqual([]);
    expect(processAPIError).toHaveBeenCalledTimes(1);
    expect(primary.prompts).toHaveLength(0);
    expect(fallback.prompts).toHaveLength(1);
    expect(requests).toBe(1);
  });

  it('bypasses downloading provider-supported URLs on later turns', async () => {
    const supported = makeModel(true);
    const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(() => ({ retry: false }));
    const { run, memory } = setup({ models: [supported.model], errorProcessor: { id: 'unused', processAPIError } });
    failure = '404';
    expect((await run(attachment())).text).toBe('ok');
    await waitForHistory(memory);
    expect((await run('Continue')).text).toBe('ok');
    expect(requests).toBe(0);
    expect(processAPIError).not.toHaveBeenCalled();
    expect(supported.prompts).toHaveLength(2);
  });

  it('recovers through generate after a successful attachment-bearing turn', async () => {
    const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(({ messages, messageList }) => {
      messageList.removeByIds(
        messages.filter(message => JSON.stringify(message).includes(url)).map(message => message.id),
      );
      return { retry: true };
    });
    const { agent, memory, prompts } = setup({ errorProcessor: { id: 'repair', processAPIError } });
    const options = { memory: { thread: 'thread', resource: 'resource' }, maxSteps: 5, maxProcessorRetries: 1 };
    expect((await agent.generate(attachment(), options)).text).toBe('ok');
    await waitForHistory(memory);
    failure = '404';
    const result = await agent.generate('Continue', options);
    expect(result.text).toBe('ok');
    expect(result.error).toBeUndefined();
    expect(processAPIError).toHaveBeenCalledTimes(1);
    expect(prompts).toHaveLength(2);
  });

  it.each(['processInputStep', 'processLLMRequest'] as const)(
    'does not route exceptions from %s through error processors',
    async hook => {
      const processorError = new Error('Processor failed');
      const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(() => ({ retry: true }));
      const fail = () => {
        throw processorError;
      };
      const { run, prompts } = setup({
        inputProcessor:
          hook === 'processInputStep'
            ? { id: 'throwing-input', processInputStep: fail }
            : { id: 'throwing-input', processLLMRequest: fail },
        errorProcessor: { id: 'unused', processAPIError },
      });
      const result = await run('Hello');
      expect(result.text).toBe('');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({ message: expect.stringContaining(processorError.message) });
      expect(processAPIError).not.toHaveBeenCalled();
      expect(prompts).toHaveLength(0);
    },
  );

  it('does not advance fallback models after an error processor TripWire', async () => {
    const primary = makeModel();
    const fallback = makeModel(true);
    const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(({ abort }) => abort('Stop recovering'));
    const { run } = setup({
      models: [primary.model, fallback.model],
      errorProcessor: { id: 'tripwire', processAPIError },
    });
    failure = '404';
    const result = await run(attachment());
    expect(processAPIError).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('');
    expect(primary.prompts).toHaveLength(0);
    expect(fallback.prompts).toHaveLength(0);
    expect(requests).toBe(1);
    expect(processAPIError.mock.results[0]).toMatchObject({ type: 'throw', value: { message: 'Stop recovering' } });
  });

  it('does not retry or advance models when an error processor aborts the run', async () => {
    const primary = makeModel();
    const fallback = makeModel(true);
    const controller = new AbortController();
    const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(() => {
      controller.abort();
      return { retry: true };
    });
    const { run } = setup({
      models: [primary.model, fallback.model],
      errorProcessor: { id: 'abort-run', processAPIError },
    });
    failure = '404';
    const result = await run(attachment(), 2, controller.signal);
    expect(processAPIError).toHaveBeenCalledTimes(1);
    expect(result.chunks.some(chunk => chunk.type === 'abort')).toBe(true);
    expect(result.errors).toEqual([]);
    expect(primary.prompts).toHaveLength(0);
    expect(fallback.prompts).toHaveLength(0);
    expect(requests).toBe(1);
  });
});
