import { createOpenAI } from '@ai-sdk/openai-v5';
import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Destructuring the stream result (moved from save-and-errors.e2e, which ran
 * this once against a hash-matched recording on the normal engine).
 *
 * `const { consumeStream, text } = await agent.stream(...)` detaches methods
 * from the output object. They touch private fields, so they only work when
 * the output binds them (`createDestructurableOutput` in loop.ts).
 */
describeForAllEngines('AIMock loop scenario: stream result destructuring', engine => {
  const getMock = useLoopScenarioAimock();
  // Remote Inngest workers intentionally retain the existing empty request metadata.
  const localRequestTest = engine === 'inngest' ? it.fails : it;

  async function streamHello() {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', userMessage: 'Say hello' },
      { content: 'Hello there!', usage: { input_tokens: 4, output_tokens: 3 } },
    );
    const { agent } = await createSharedAgent(llm, { engine, instructions: 'You are a helpful assistant.' });
    const result: any = await agent.stream('Say hello');
    const output = isDurableEngineVariant(engine) ? result.output : result;
    return { llm, result, output };
  }

  it('keeps promise getters and streams working after destructuring', async () => {
    const { llm, result, output } = await streamHello();
    const { fullStream, textStream, text, usage, toolCalls, finishReason } = output;

    try {
      await output.consumeStream();

      expect(await text).toBe('Hello there!');
      expect(await toolCalls).toEqual([]);
      expect(await finishReason).toBe('stop');
      expect(await usage).toMatchObject({ inputTokens: 4, outputTokens: 3, totalTokens: 7 });
      expect(fullStream).toBeInstanceOf(ReadableStream);
      expect(textStream).toBeInstanceOf(ReadableStream);
      expect(llm.getRequests()).toHaveLength(1);
    } finally {
      result.cleanup?.();
    }
  });

  it('exposes the provider request after destructuring', async () => {
    const { result, output } = await streamHello();
    const { request } = output;

    try {
      await output.consumeStream();
      expect(await request).toBeDefined();
    } finally {
      result.cleanup?.();
    }
  });

  localRequestTest('exposes the provider request body', async () => {
    const { llm, result, output } = await streamHello();
    const { request } = output;

    try {
      await output.consumeStream();
      expect((await request).body).toMatchObject({ model: llm.getRequests()[0]!.body!.model });
      expect(JSON.stringify((await request).body)).toContain('Say hello');
    } finally {
      result.cleanup?.();
    }
  });

  localRequestTest.each(['stream', 'generate'] as const)(
    'returns the same provider request in %s and onFinish',
    async method => {
      const llm = getMock();
      llm.on({ endpoint: 'chat', userMessage: 'Request parity' }, { content: 'Done.' });
      const { agent } = await createSharedAgent(llm, { engine });
      let callbackRequest: unknown;
      const result: any = await agent[method]('Request parity', {
        onFinish: (event: { request: unknown }) => {
          callbackRequest = event.request;
        },
      });
      try {
        const output = isDurableEngineVariant(engine) && method === 'stream' ? result.output : result;
        if (method === 'stream') await output.consumeStream();
        const request = await output.request;
        expect(request.body).toMatchObject({ model: llm.getRequests()[0]!.body!.model });
        expect(JSON.stringify(request.body)).toContain('Request parity');
        await expect.poll(() => callbackRequest).toEqual(request);
      } finally {
        result.cleanup?.();
      }
    },
  );

  it.skipIf(engine === 'inngest').each(['mid-stream', 'next-step', 'retry-preparation'] as const)(
    'reports the terminating attempt request without reusing an earlier attempt (%s)',
    async failure => {
      const failAfterTool = failure === 'next-step';
      const failDuringRetryPreparation = failure === 'retry-preparation';
      const llm = getMock();
      if (failAfterTool) {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          {
            toolCalls: [{ name: 'lookup', arguments: {}, id: 'call_error_lookup' }],
          },
        );
      }
      llm.on({ endpoint: 'chat', sequenceIndex: failAfterTool ? 1 : 0 }, { content: 'Partial answer.' });
      const provider = createOpenAI({ apiKey: 'test', baseURL: `${llm.url}/v1` }).chat('gpt-4o-mini');
      let calls = 0;
      const model = {
        specificationVersion: provider.specificationVersion,
        provider: provider.provider,
        modelId: provider.modelId,
        supportedUrls: provider.supportedUrls,
        doGenerate: provider.doGenerate.bind(provider),
        doStream: async (options: Parameters<typeof provider.doStream>[0]) => {
          calls++;
          if (failAfterTool && calls === 2) throw new Error('Failed before capturing a request');
          const response = await provider.doStream(options);
          return {
            ...response,
            request: { body: failAfterTool ? 'PRIVATE_EARLIER_REQUEST' : 'PRIVATE_ERROR_REQUEST' },
            stream: failAfterTool
              ? response.stream
              : response.stream.pipeThrough(
                  new TransformStream({
                    transform(chunk, controller) {
                      if (chunk.type === 'text-delta') {
                        controller.enqueue({ type: 'error', error: new Error('Provider failed mid-stream') });
                        controller.terminate();
                      } else {
                        controller.enqueue(chunk);
                      }
                    },
                  }),
                ),
          };
        },
      };
      const pubsub = new EventEmitterPubSub();
      let preparations = 0;
      const { agent, mastra } = await createSharedAgent(llm, {
        engine,
        model: failDuringRetryPreparation
          ? () => [
              { id: 'primary-model', model, maxRetries: 0 },
              { id: 'fallback-model', model, maxRetries: 0 },
            ]
          : model,
        pubsub,
        errorProcessors: [],
        maxRetries: 0,
        inputProcessors: failDuringRetryPreparation
          ? [
              {
                id: 'fail-retry-preparation',
                processLLMRequest: () => {
                  if (++preparations === 2) throw new Error('Failed before retry request capture');
                },
              },
            ]
          : undefined,
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Look up a value',
            inputSchema: z.object({}),
            execute: async () => ({ value: 'found' }),
          }),
        },
      });
      const serialized: string[] = [];
      const boundaries = { publish: 0, persist: 0, results: 0, state: 0 };
      if (isDurableEngineVariant(engine)) {
        const publish = pubsub.publish.bind(pubsub);
        vi.spyOn(pubsub, 'publish').mockImplementation((...args) => {
          boundaries.publish++;
          serialized.push(JSON.stringify(args));
          return publish(...args);
        });
        const store = await mastra.getStorage()?.getStore('workflows');
        expect(store).toBeDefined();
        if (store) {
          const persist = store.persistWorkflowSnapshot.bind(store);
          vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation((...args) => {
            boundaries.persist++;
            serialized.push(JSON.stringify(args));
            return persist(...args);
          });
          const results = store.updateWorkflowResults.bind(store);
          vi.spyOn(store, 'updateWorkflowResults').mockImplementation((...args) => {
            boundaries.results++;
            serialized.push(JSON.stringify(args));
            return results(...args);
          });
          const state = store.updateWorkflowState.bind(store);
          vi.spyOn(store, 'updateWorkflowState').mockImplementation((...args) => {
            boundaries.state++;
            serialized.push(JSON.stringify(args));
            return state(...args);
          });
        }
      }
      const onFinish = vi.fn();
      const result: any = await agent.stream('Report the failed request', { maxSteps: 3, onFinish });
      const output = result.output ?? result;
      try {
        await output.consumeStream();
        expect(await output.finishReason).toBe('error');
        expect(calls).toBe(failAfterTool ? 2 : 1);
        // Normal/fs stop on the stream error; durable/evented try the fallback,
        // whose preparation fails before it captures a request.
        const failedPreparation = failDuringRetryPreparation && isDurableEngineVariant(engine);
        if (failDuringRetryPreparation) expect(preparations).toBe(failedPreparation ? 2 : 1);
        expect((await output.request).body).toBe(
          failAfterTool || failedPreparation ? undefined : 'PRIVATE_ERROR_REQUEST',
        );
        expect(onFinish).not.toHaveBeenCalled();
        if (isDurableEngineVariant(engine)) {
          expect(boundaries.publish).toBeGreaterThan(0);
          expect(boundaries.persist).toBeGreaterThan(0);
          if (engine === 'evented') {
            expect(boundaries.results).toBeGreaterThan(0);
            expect(boundaries.state).toBeGreaterThan(0);
          }
          expect(serialized.join('\n')).not.toMatch(/PRIVATE_(ERROR|EARLIER)_REQUEST/);
        }
      } finally {
        result.cleanup?.();
      }
    },
  );

  localRequestTest('selects the fallback model request after a failed primary', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', model: 'primary-model' },
      {
        error: { message: 'primary unavailable', type: 'server_error', code: 'bad_request' },
        status: 400,
      },
    );
    llm.on({ endpoint: 'chat', model: 'fallback-model' }, { content: 'Fallback answer.' });
    const provider = createOpenAI({ apiKey: 'test', baseURL: `${llm.url}/v1` });
    const { agent } = await createSharedAgent(llm, {
      engine,
      errorProcessors: [],
      model: () => [
        { id: 'primary-model', model: provider.chat('primary-model'), maxRetries: 0 },
        { id: 'fallback-model', model: provider.chat('fallback-model'), maxRetries: 0 },
      ],
    });
    const result: any = await agent.stream('Choose a working model');
    const output = result.output ?? result;
    try {
      await output.consumeStream();
      expect(llm.getRequests().map(request => request.body?.model)).toEqual(['primary-model', 'fallback-model']);
      expect((await output.request).body).toMatchObject({ model: 'fallback-model' });
    } finally {
      result.cleanup?.();
    }
  });

  localRequestTest('selects the request containing processor retry feedback', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Rejected draft.' });
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Accepted answer.' });
    const { agent } = await createSharedAgent(llm, { engine });
    const result: any = await agent.stream('Retry this answer', {
      maxProcessorRetries: 1,
      outputProcessors: [
        {
          id: 'request-retry',
          processOutputStep: async ({ retryCount, abort, messageList }) => {
            if (retryCount === 0) abort('Please rewrite the rejected draft', { retry: true });
            return messageList;
          },
        },
      ],
    });
    const output = result.output ?? result;
    try {
      await output.consumeStream();
      expect(llm.getRequests()).toHaveLength(2);
      expect(await output.text).toBe('Accepted answer.');
      expect(JSON.stringify((await output.request).body)).toContain('Please rewrite the rejected draft');
    } finally {
      result.cleanup?.();
    }
  });

  it.skipIf(engine === 'inngest').each([false, true])(
    'returns cached request metadata without calling the provider (%s)',
    async hasBody => {
      const llm = getMock();
      const request = hasBody ? { body: 'private-cached-request' } : {};
      const pubsub = new EventEmitterPubSub();
      const { agent, mastra } = await createSharedAgent(llm, {
        engine,
        pubsub,
        inputProcessors: [
          {
            id: 'cached-request',
            processLLMRequest: () => ({
              response: {
                request,
                warnings: [],
                rawResponse: {},
                chunks: [
                  { type: 'stream-start', payload: { warnings: [] } },
                  { type: 'text-start', payload: { id: 'cached-text' } },
                  { type: 'text-delta', payload: { id: 'cached-text', text: 'Cached answer.' } },
                  { type: 'text-end', payload: { id: 'cached-text' } },
                  {
                    type: 'finish',
                    payload: {
                      stepResult: { reason: 'stop' },
                      output: {
                        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                      },
                      metadata: {},
                      messages: { all: [], user: [], nonUser: [] },
                    },
                  },
                ],
              },
            }),
          },
        ],
      });
      const serialized: string[] = [];
      const boundaries = { publish: 0, persist: 0, results: 0, state: 0 };
      if (isDurableEngineVariant(engine)) {
        const publish = pubsub.publish.bind(pubsub);
        vi.spyOn(pubsub, 'publish').mockImplementation((...args) => {
          boundaries.publish++;
          serialized.push(JSON.stringify(args));
          return publish(...args);
        });
        const store = await mastra.getStorage()?.getStore('workflows');
        expect(store).toBeDefined();
        if (store) {
          const persist = store.persistWorkflowSnapshot.bind(store);
          vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation((...args) => {
            boundaries.persist++;
            serialized.push(JSON.stringify(args));
            return persist(...args);
          });
          const updateResults = store.updateWorkflowResults.bind(store);
          vi.spyOn(store, 'updateWorkflowResults').mockImplementation((...args) => {
            boundaries.results++;
            serialized.push(JSON.stringify(args));
            return updateResults(...args);
          });
          const updateState = store.updateWorkflowState.bind(store);
          vi.spyOn(store, 'updateWorkflowState').mockImplementation((...args) => {
            boundaries.state++;
            serialized.push(JSON.stringify(args));
            return updateState(...args);
          });
        }
      }
      const result: any = await agent.stream('Use the cached answer');
      const output = result.output ?? result;
      try {
        await output.consumeStream();
        expect(await output.text).toBe('Cached answer.');
        expect(llm.getRequests()).toHaveLength(0);
        expect(await output.request).toEqual(request);
        if (isDurableEngineVariant(engine)) {
          expect(boundaries.publish).toBeGreaterThan(0);
          expect(boundaries.persist).toBeGreaterThan(0);
          if (engine === 'evented') {
            expect(boundaries.results).toBeGreaterThan(0);
            expect(boundaries.state).toBeGreaterThan(0);
          }
          expect(serialized.join('\n')).not.toContain('private-cached-request');
        }
      } finally {
        result.cleanup?.();
      }
    },
  );

  // A custom in-process provider boundary cannot be shipped to a remote worker.
  it.skipIf(engine === 'inngest').each([false, true])(
    'selects the final step request, including an empty replacement (%s)',
    async emptyFinal => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        {
          toolCalls: [{ id: 'request-tool', name: 'lookup', arguments: {} }],
        },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Finished lookup.' });
      const provider = createOpenAI({ apiKey: 'test', baseURL: `${llm.url}/v1` }).chat('gpt-4o-mini');
      let calls = 0;
      const requests: unknown[] = [];
      const model = {
        specificationVersion: provider.specificationVersion,
        provider: provider.provider,
        modelId: provider.modelId,
        supportedUrls: provider.supportedUrls,
        doGenerate: provider.doGenerate.bind(provider),
        async doStream(options: Parameters<typeof provider.doStream>[0]) {
          const response = await provider.doStream(options);
          const request = ++calls === 2 && emptyFinal ? {} : { body: `PRIVATE_REQUEST_${calls}` };
          requests.push(request);
          return { ...response, request };
        },
      };
      const pubsub = new EventEmitterPubSub();
      const { agent, mastra } = await createSharedAgent(llm, {
        engine,
        model,
        pubsub,
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Look up a value',
            inputSchema: z.object({}),
            execute: async () => ({ value: 'found' }),
          }),
        },
      });
      const serialized: string[] = [];
      const boundaries = { publish: 0, persist: 0, results: 0, state: 0 };
      if (isDurableEngineVariant(engine)) {
        const publish = pubsub.publish.bind(pubsub);
        vi.spyOn(pubsub, 'publish').mockImplementation((...args) => {
          boundaries.publish++;
          serialized.push(JSON.stringify(args));
          return publish(...args);
        });
        const store = await mastra.getStorage()?.getStore('workflows');
        expect(store).toBeDefined();
        if (store) {
          const persist = store.persistWorkflowSnapshot.bind(store);
          vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation((...args) => {
            boundaries.persist++;
            serialized.push(JSON.stringify(args));
            return persist(...args);
          });
          const updateResults = store.updateWorkflowResults.bind(store);
          vi.spyOn(store, 'updateWorkflowResults').mockImplementation((...args) => {
            boundaries.results++;
            serialized.push(JSON.stringify(args));
            return updateResults(...args);
          });
          const updateState = store.updateWorkflowState.bind(store);
          vi.spyOn(store, 'updateWorkflowState').mockImplementation((...args) => {
            boundaries.state++;
            serialized.push(JSON.stringify(args));
            return updateState(...args);
          });
        }
      }
      let callbackRequest: unknown;
      const result: any = await agent.stream('Look up a value.', {
        maxSteps: 3,
        onFinish: (event: { request: unknown }) => {
          callbackRequest = event.request;
        },
      });
      const output = result.output ?? result;
      try {
        await output.consumeStream();
        expect(llm.getRequests()).toHaveLength(2);
        expect(await output.request).toEqual(requests[1]);
        await expect.poll(() => callbackRequest).toEqual(requests[1]);
        if (isDurableEngineVariant(engine)) {
          expect(boundaries.publish).toBeGreaterThan(0);
          expect(boundaries.persist).toBeGreaterThan(0);
          if (engine === 'evented') {
            expect(boundaries.results).toBeGreaterThan(0);
            expect(boundaries.state).toBeGreaterThan(0);
          }
          const leaks: string[] = [];
          const visit = (value: unknown, path: string) => {
            if (typeof value === 'string' && value.includes('PRIVATE_REQUEST_')) leaks.push(path);
            else if (value && typeof value === 'object') {
              for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
            }
          };
          serialized.forEach(entry => visit(JSON.parse(entry), 'event'));
          expect([...new Set(leaks)]).toEqual([]);
        }
      } finally {
        result.cleanup?.();
      }
    },
  );

  localRequestTest('keeps concurrent local requests separate and retains them after cleanup', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Done.' });
    const { agent } = await createSharedAgent(llm, { engine });
    const results: any[] = await Promise.all(['alpha-private', 'beta-private'].map(prompt => agent.stream(prompt)));
    try {
      const requests = await Promise.all(
        results.map(async result => {
          const output = result.output ?? result;
          await output.consumeStream();
          result.cleanup?.();
          return JSON.stringify((await output.request).body);
        }),
      );
      expect(requests[0]).toContain('alpha-private');
      expect(requests[0]).not.toContain('beta-private');
      expect(requests[1]).toContain('beta-private');
      expect(requests[1]).not.toContain('alpha-private');
    } finally {
      results.forEach(result => result.cleanup?.());
    }
  });

  localRequestTest('delivers the local request to onFinish before an external consumer drains the stream', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Done.' });
    const { agent } = await createSharedAgent(llm, { engine });
    const onFinish = vi.fn();
    const result: any = await agent.stream('Delayed consumer', { onFinish });
    const output = result.output ?? result;
    try {
      // Normal/fs callbacks are consumption-driven; durable callbacks are delivery-driven.
      if (isDurableEngineVariant(engine)) await vi.waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
      await output.consumeStream();
      await vi.waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
      expect(onFinish.mock.calls[0]![0].request).toEqual(await output.request);
      expect(JSON.stringify((await output.request).body)).toContain('Delayed consumer');
    } finally {
      result.cleanup?.();
    }
  });

  it('keeps consumeStream bound after destructuring', async () => {
    const { result, output } = await streamHello();
    const { consumeStream } = output;

    try {
      await expect(consumeStream()).resolves.toBeUndefined();
      expect(await output.text).toBe('Hello there!');
    } finally {
      // Drain through the output itself so a failed destructured call does
      // not leave the run hitting the mock after it shuts down.
      await output.consumeStream();
      result.cleanup?.();
    }
  });
});
