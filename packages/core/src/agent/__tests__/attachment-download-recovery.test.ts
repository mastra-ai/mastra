import { once } from 'node:events';
import { createServer } from 'node:http';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Memory } from '../../../../memory/src';
import { MastraError } from '../../error';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { ErrorProcessorOrWorkflow, InputProcessorOrWorkflow, Processor } from '../../processors';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';

function makeModel(supported: boolean | 'data-urls' = false) {
  const prompts: LanguageModelV2Prompt[] = [];
  const model = new MockLanguageModelV2({
    supportedUrls:
      supported === 'data-urls'
        ? { '*/*': [/^data:/] }
        : supported
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

/** Calls a tool on its first step, then answers, so one run makes two model calls. */
function makeToolCallingModel() {
  const prompts: LanguageModelV2Prompt[] = [];
  const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        stream: convertArrayToReadableStream(
          prompts.length === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 'text' },
                { type: 'text-delta', id: 'text', delta: 'ok' },
                { type: 'text-end', id: 'text' },
                { type: 'finish', finishReason: 'stop', usage },
              ],
        ),
      };
    },
  });
  return { model, prompts };
}

const lookupTool = createTool({
  id: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({}),
  execute: async () => ({ found: true }),
});

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
    tools,
  }: {
    durable?: boolean;
    errorProcessor?: ErrorProcessorOrWorkflow;
    inputProcessor?: InputProcessorOrWorkflow;
    models?: MockLanguageModelV2[];
    tools?: Record<string, typeof lookupTool>;
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
      errorProcessors: errorProcessor ? [errorProcessor] : [],
      tools,
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

  function promptAttachments(prompt: LanguageModelV2Prompt) {
    const parts = prompt.flatMap(message => (message.role === 'user' ? message.content : []));
    return {
      files: parts.filter(part => part.type === 'file'),
      placeholders: parts.flatMap(part =>
        part.type === 'text' && part.text.startsWith('[Attachment unavailable') ? [part.text] : [],
      ),
    };
  }

  describe.each([false, true])('durable: %s', durable => {
    it.each([false, true])(
      'skips an unavailable attachment that nothing recovers, with an error processor present: %s',
      async present => {
        const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(() => ({ retry: false }));
        const { run, memory, prompts } = setup({
          durable,
          errorProcessor: present ? { id: 'decline', processAPIError } : undefined,
        });
        expect((await run(attachment())).text).toBe('ok');
        await waitForHistory(memory);
        failure = '404';
        for (let turn = 0; turn < 2; turn++) {
          const result = await run('Continue');
          expect(result.errors).toEqual([]);
          expect(result.text).toBe('ok');
        }
        // Error processors still get the first chance to recover, on the turn it first fails.
        expect(processAPIError).toHaveBeenCalledTimes(present ? 1 : 0);
        expect(prompts).toHaveLength(3);
        for (const prompt of prompts.slice(1)) {
          expect(promptAttachments(prompt)).toEqual({
            files: [],
            placeholders: ['[Attachment unavailable: application/pdf]'],
          });
        }
        // First turn, then the failed download and the check before skipping it. The
        // attachment is then recorded as unavailable, so the last turn does not fetch it.
        expect(requests).toBe(3);
        await waitForHistory(memory); // The attachment itself stays in stored history.
        const { messages } = await memory.recall({ threadId: 'thread', resourceId: 'resource' });
        const stored = messages.find(message => JSON.stringify(message.content.parts).includes(url));
        expect(stored?.content.metadata?.mastra).toMatchObject({ unavailableAttachments: [url] });
      },
    );
  });

  describe.each([false, true])('durable: %s', durable => {
    it('downloads an attachment once per run, not once per step', async () => {
      const toolCalling = makeToolCallingModel();
      const { run } = setup({ durable, models: [toolCalling.model], tools: { lookup: lookupTool } });
      const result = await run(attachment());
      expect(result.errors).toEqual([]);
      expect(result.text).toBe('ok');
      expect(toolCalling.prompts).toHaveLength(2);
      for (const prompt of toolCalling.prompts) {
        expect(promptAttachments(prompt).files).toHaveLength(1);
      }
      expect(requests).toBe(1);
    });

    it('records an unavailable attachment on a later message that sends it again', async () => {
      const { run, memory, prompts } = setup({ durable });
      expect((await run(attachment())).text).toBe('ok');
      await waitForHistory(memory);
      failure = '404';
      expect((await run('Continue')).text).toBe('ok');
      const fetched = requests;

      const resent = await run(attachment());
      expect(resent.errors).toEqual([]);
      expect(resent.text).toBe('ok');
      expect(requests).toBe(fetched);
      expect(promptAttachments(prompts.at(-1)!).placeholders).toEqual([
        '[Attachment unavailable: application/pdf]',
        '[Attachment unavailable: application/pdf]',
      ]);
      await vi.waitFor(async () => {
        const { messages } = await memory.recall({ threadId: 'thread', resourceId: 'resource' });
        const carrying = messages.filter(message => JSON.stringify(message.content.parts).includes(url));
        expect(carrying).toHaveLength(2);
        for (const message of carrying) {
          expect(message.content.metadata?.mastra).toMatchObject({ unavailableAttachments: [url] });
        }
      });
    });

    it('replaces an undecodable data URL in history with a placeholder right away', async () => {
      const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(() => ({ retry: true }));
      const { run, memory, prompts } = setup({ durable, errorProcessor: { id: 'unused', processAPIError } });
      // A relative path persisted as a base64 data URL by older versions (#23705).
      await memory.saveThread({
        thread: { id: 'thread', resourceId: 'resource', createdAt: new Date(), updatedAt: new Date() },
      });
      await memory.saveMessages({
        messages: [
          {
            id: 'poisoned',
            role: 'user',
            threadId: 'thread',
            resourceId: 'resource',
            createdAt: new Date(),
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'Look at this' },
                { type: 'file', mimeType: 'image/svg+xml', data: 'data:image/svg+xml;base64,/api/images/foo.svg' },
              ],
            },
          },
        ],
      });
      const result = await run('Continue');
      expect(result.errors).toEqual([]);
      expect(result.text).toBe('ok');
      expect(processAPIError).not.toHaveBeenCalled();
      expect(prompts).toHaveLength(1);
      expect(promptAttachments(prompts[0]!).placeholders).toEqual(['[Attachment unavailable: image/svg+xml]']);
    });

    it.each([
      [
        'model file part',
        { role: 'user', content: [{ type: 'file', data: '/api/images/foo.svg', mediaType: 'image/svg+xml' }] },
      ],
      [
        'model image part',
        { role: 'user', content: [{ type: 'image', image: '/api/images/foo.svg', mediaType: 'image/svg+xml' }] },
      ],
      [
        'UI message file part',
        { id: 'ui-1', role: 'user', parts: [{ type: 'file', url: '/api/images/foo.svg', mediaType: 'image/svg+xml' }] },
      ],
      [
        'protocol-relative URL',
        { role: 'user', content: [{ type: 'file', data: '//cdn.example.com/foo.svg', mediaType: 'image/svg+xml' }] },
      ],
    ])(
      'answers a new %s with a relative path using a placeholder, on this turn and later ones',
      async (_label, message) => {
        const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(() => ({ retry: false }));
        const { run, prompts } = setup({ durable, errorProcessor: { id: 'decline', processAPIError } });

        for (const input of [[message], 'Continue'] as Parameters<Agent['stream']>[0][]) {
          const result = await run(input);
          expect(result.errors).toEqual([]);
          expect(result.text).toBe('ok');
        }
        expect(prompts.length).toBeGreaterThanOrEqual(2);
        for (const prompt of prompts) {
          expect(promptAttachments(prompt)).toEqual({
            files: [],
            placeholders: ['[Attachment unavailable: image/svg+xml]'],
          });
        }
      },
    );

    // Models that accept data URLs get them as-is, so invalid content would reach the provider
    // (and be rejected on every turn) without being caught by a download failure.
    it.each([
      ['a new file part with an extensionless relative path', 'input', '/api/attachments/123', 'image/png'],
      [
        'a stored data URL wrapping a relative path',
        'stored',
        'data:image/png;base64,/api/images/foo.png',
        'image/png',
      ],
      ['image data that is not an image', 'input', 'data:image/png;base64,aGVsbG8=', 'image/png'],
      ['PDF data that is not a PDF', 'input', 'data:application/pdf;base64,aGVsbG8=', 'application/pdf'],
    ] as const)(
      'gives %s the placeholder when the model accepts data URLs',
      async (_label, source, data, mediaType) => {
        const dataUrlModel = makeModel('data-urls');
        const { run, memory } = setup({ durable, models: [dataUrlModel.model] });
        const filePart = { type: 'file' as const, data, mediaType };
        if (source === 'stored') {
          await memory.saveThread({
            thread: { id: 'thread', resourceId: 'resource', createdAt: new Date(), updatedAt: new Date() },
          });
          await memory.saveMessages({
            messages: [
              {
                id: 'poisoned',
                role: 'user',
                threadId: 'thread',
                resourceId: 'resource',
                createdAt: new Date(),
                content: { format: 2, parts: [{ type: 'file', mimeType: mediaType, data }] },
              },
            ],
          });
        } else {
          const result = await run([{ role: 'user', content: [filePart] }]);
          expect(result.errors).toEqual([]);
        }
        const result = await run('Continue');
        expect(result.errors).toEqual([]);
        expect(result.text).toBe('ok');
        for (const prompt of dataUrlModel.prompts) {
          expect(promptAttachments(prompt)).toEqual({
            files: [],
            placeholders: [`[Attachment unavailable: ${mediaType}]`],
          });
        }
      },
    );

    it.each([
      [
        'PNG',
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'image/png',
      ],
      ['JPEG labelled as PNG', '/9j/4AAQSkZJRgABAQ==', 'image/png'],
      ['SVG', 'PHN2Zz48L3N2Zz4=', 'image/svg+xml'],
      ['PDF', 'JVBERi0xLjQK', 'application/pdf'],
    ] as const)('still sends real %s content to a model that accepts data URLs', async (_label, data, mediaType) => {
      const dataUrlModel = makeModel('data-urls');
      const { run } = setup({ durable, models: [dataUrlModel.model] });
      const result = await run([{ role: 'user', content: [{ type: 'file', data, mediaType }] }]);
      expect(result.errors).toEqual([]);
      expect(dataUrlModel.prompts).toHaveLength(1);
      const { files, placeholders } = promptAttachments(dataUrlModel.prompts[0]!);
      expect(placeholders).toEqual([]);
      expect(files).toHaveLength(1);
    });

    it('records the attachment on stored messages that carry a URL recorded elsewhere in history', async () => {
      const { run, memory, prompts } = setup({ durable });
      await memory.saveThread({
        thread: { id: 'thread', resourceId: 'resource', createdAt: new Date(), updatedAt: new Date() },
      });
      const stored = (id: string, createdAt: Date, metadata?: Record<string, unknown>) => ({
        id,
        role: 'user' as const,
        threadId: 'thread',
        resourceId: 'resource',
        createdAt,
        content: {
          format: 2 as const,
          parts: [{ type: 'file' as const, mimeType: 'application/pdf', data: url }],
          ...(metadata ? { metadata } : {}),
        },
      });
      await memory.saveMessages({
        messages: [
          stored('recorded', new Date(1_000), { mastra: { sealed: true, unavailableAttachments: [url] } }),
          stored('unrecorded', new Date(2_000), { mastra: { sealed: true } }),
        ],
      });
      const result = await run('Continue');
      expect(result.errors).toEqual([]);
      expect(result.text).toBe('ok');
      expect(requests).toBe(0);
      expect(promptAttachments(prompts[0]!).placeholders).toHaveLength(2);
      const { messages } = await memory.recall({ threadId: 'thread', resourceId: 'resource' });
      expect(messages.find(message => message.id === 'unrecorded')?.content.metadata?.mastra).toEqual({
        sealed: true,
        unavailableAttachments: [url],
      });
    });
  });

  it.each([0, 2])('bounds unsuccessful processor retries to %i before skipping the attachment', async budget => {
    const processAPIError = vi.fn<NonNullable<Processor['processAPIError']>>(() => ({ retry: true }));
    const { run, prompts } = setup({ errorProcessor: { id: 'retry-without-repair', processAPIError } });
    failure = '404';
    const result = await run(attachment(), budget);
    expect(result.errors).toEqual([]);
    expect(result.text).toBe('ok');
    expect(processAPIError.mock.calls.map(([args]) => args.retryCount)).toEqual(
      Array.from({ length: budget + 1 }, (_, i) => i),
    );
    expect(prompts).toHaveLength(1);
    expect(promptAttachments(prompts[0]!).placeholders).toEqual(['[Attachment unavailable: application/pdf]']);
    expect(requests).toBe(budget + 2);
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
