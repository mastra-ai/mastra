import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MessageList } from '@mastra/core/agent/message-list';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { DefaultObservabilityInstance } from '../instances/default';
import { SensitiveDataFilter } from '../span_processors/sensitive-data-filter';
import { MastraPlatformExporter } from './mastra-platform';
import { MastraStorageExporter } from './mastra-storage';
import { withSpanPreviews } from './span-previews';

function span(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  return {
    id: 'span',
    traceId: 'trace',
    name: 'Preview example',
    type: SpanType.AGENT_RUN,
    startTime: new Date(),
    isEvent: false,
    isRootSpan: true,
    attributes: {},
    ...overrides,
  };
}

const fields = (value: {
  inputPreview?: string | null;
  outputPreview?: string | null;
  errorPreview?: string | null;
}) => ({
  inputPreview: value.inputPreview,
  outputPreview: value.outputPreview,
  errorPreview: value.errorPreview,
});

describe('span previews', () => {
  it('reads actual MessageList conversions for every supported SDK generation', async () => {
    const list = new MessageList();
    list.add(
      {
        id: 'user',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Where is my order?' }],
        },
      },
      'memory',
    );
    list.add(
      {
        id: 'assistant',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Your order has shipped.' }],
        },
      },
      'memory',
    );
    const formats = [
      list.get.all.db(),
      list.get.all.aiV4.ui(),
      list.get.all.aiV4.core(),
      list.get.all.aiV5.ui(),
      list.get.all.aiV5.prompt(),
      list.get.all.aiV6.ui(),
      await list.get.all.aiV6.llmPrompt(),
      list.get.all.aiV7.ui(),
      await list.get.all.aiV7.llmPrompt(),
    ];
    for (const input of formats) {
      expect(withSpanPreviews(span({ input })).inputPreview).toBe('Where is my order?');
      expect(withSpanPreviews(span({ type: SpanType.MODEL_STEP, input })).inputPreview).toBe(
        'Assistant: Your order has shipped.',
      );
    }
  });

  it.each([
    [
      { role: 'assistant', parts: [{ type: 'tool-lookup', state: 'output-available', output: { huge: 'data' } }] },
      '[tool-result: lookup]',
    ],
    [
      { role: 'assistant', parts: [{ type: 'dynamic-tool', toolName: 'lookup', state: 'approval-requested' }] },
      '[tool-approval: lookup]',
    ],
    [
      { role: 'assistant', content: '', toolInvocations: [{ toolName: 'lookup', state: 'result' }] },
      '[tool-result: lookup]',
    ],
    [
      {
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'tool-invocation', toolInvocation: { toolName: 'lookup', state: 'call' } }],
        },
      },
      '[tool-call: lookup]',
    ],
    [{ role: 'user', content: '', experimental_attachments: [{ url: 'data:secret' }] }, '[attachment]'],
    [{ role: 'assistant', content: '', reasoning: 'Checking the order' }, 'Checking the order'],
    [{ role: 'user', parts: [{ type: 'video', data: 'secret-base64' }] }, '[video]'],
    ['Find my order', 'Find my order'],
  ])('reads message variants without dumping wrappers: %j', (message, expected) => {
    expect(withSpanPreviews(span({ input: [message] })).inputPreview).toBe(expected);
  });

  it('prefers answer text to reasoning and preserves direct signal previews', () => {
    expect(
      withSpanPreviews(
        span({
          input: [
            {
              role: 'assistant',
              parts: [
                { type: 'reasoning', text: 'Thinking '.repeat(50) },
                { type: 'text', text: 'Order shipped' },
              ],
            },
          ],
        }),
      ).inputPreview,
    ).toBe('Order shipped');
    expect(
      withSpanPreviews(span({ input: { __isCreatedSignal: true, type: 'user', contents: 'Check my order' } }))
        .inputPreview,
    ).toBe('Check my order');
  });

  it('finds useful content beyond empty parts and long tool histories', () => {
    const input = [
      {
        role: 'user',
        parts: [
          ...Array.from({ length: 40 }, () => ({ type: 'step-start' })),
          { type: 'text', text: 'Original question' },
        ],
      },
      ...Array.from({ length: 140 }, () => ({ role: 'tool', content: 'Still working' })),
    ];
    expect(withSpanPreviews(span({ input })).inputPreview).toBe('Original question');
    expect(
      withSpanPreviews(span({ type: SpanType.MODEL_CHUNK, output: { toolName: 'lookup', toolInput: '{"id":123}' } }))
        .outputPreview,
    ).toBe('lookup: {"id":123}');
  });

  it('applies the storage cap after adding readable labels, including errors', () => {
    const result = withSpanPreviews(
      span({
        type: SpanType.MODEL_STEP,
        input: [{ role: 'user', parts: [{ type: 'text', text: 'x'.repeat(200) }] }],
        output: { text: 'y'.repeat(200) },
        errorInfo: { name: 'ProviderError', message: 'z'.repeat(200) },
      }),
    );
    expect(result.inputPreview).toBe('User: ' + 'x'.repeat(94) + '…');
    for (const preview of Object.values(fields(result))) {
      expect(preview?.length).toBeLessThanOrEqual(101);
      expect(preview?.endsWith('…')).toBe(true);
    }
  });

  it('shows the user request on the agent and the latest tool context on the next model step', () => {
    const input = [
      { role: 'system', content: 'Follow the instructions' },
      { role: 'user', content: 'Find my order' },
      { role: 'tool', content: 'Order 123 was shipped' },
    ];
    expect(withSpanPreviews(span({ input })).inputPreview).toBe('Find my order');
    expect(withSpanPreviews(span({ type: SpanType.MODEL_STEP, input })).inputPreview).toBe(
      'Tool: Order 123 was shipped',
    );
    expect(withSpanPreviews(span({ type: SpanType.MODEL_GENERATION, input: { messages: input } })).inputPreview).toBe(
      'Find my order',
    );
  });

  it.each([
    [{ object: false, text: 'ignored' }, 'false'],
    [{ object: 0 }, '0'],
    [{ object: {} }, '{}'],
    [{ object: [] }, '[]'],
    [{ text: '', toolCalls: [{ toolName: 'lookup_order' }] }, 'Tool calls: lookup_order'],
    [{ status: 'suspended', reason: 'Awaiting approval', toolName: 'refund' }, 'Suspended: Awaiting approval (refund)'],
    [{ tripwire: { reason: 'Sensitive information' } }, 'Tripwire: Sensitive information'],
    [{ files: [{ data: 'binary' }] }, '1 generated file(s)'],
  ])('previews meaningful results without losing empty structured values: %j', (output, expected) => {
    expect(withSpanPreviews(span({ output })).outputPreview).toBe(expected);
  });

  it('distinguishes resume data from conversation messages', () => {
    expect(
      withSpanPreviews(
        span({
          metadata: { resumed: true },
          input: {
            toolName: 'approval',
            resumeData: { approved: true },
          },
        }),
      ).inputPreview,
    ).toBe('Resume approval: {"approved":true}');
    expect(withSpanPreviews(span({ metadata: { resumed: true }, input: 'approved' })).inputPreview).toBe(
      'Resume: approved',
    );
  });

  it('summarizes image-only requests and MCP output without binary data', () => {
    expect(
      withSpanPreviews(span({ input: [{ role: 'user', content: [{ type: 'image', image: 'secret-base64' }] }] }))
        .inputPreview,
    ).toBe('[image]');
    expect(
      withSpanPreviews(
        span({
          type: SpanType.MCP_TOOL_CALL,
          output: {
            content: [
              { type: 'text', text: 'Found the order' },
              { type: 'image', data: 'secret-base64' },
            ],
          },
        }),
      ).outputPreview,
    ).toBe('Found the order [image]');
  });

  it('uses the processor phase even when the processor has a domain span type', () => {
    expect(
      withSpanPreviews(
        span({
          type: SpanType.MEMORY_OPERATION,
          attributes: { processorPhase: 'inputStep' },
          output: { messages: [] },
        }),
      ).outputPreview,
    ).toBe('messages replaced');
    expect(
      withSpanPreviews(span({ type: SpanType.PROCESSOR_RUN, attributes: { processorPhase: 'input' }, output: {} }))
        .outputPreview,
    ).toBe('No recorded changes');
  });

  it.each([
    [SpanType.CLASSIFIER_EVALUATION, { answers: { valid: false } }, '{"valid":false}'],
    [SpanType.SCORER_RUN, { score: 0, reason: 'No match' }, 'Score: 0 — No match'],
    [SpanType.RAG_EMBEDDING, { dimensions: 1536 }, '1536 dimensions'],
    [SpanType.RAG_VECTOR_OPERATION, { returned: 0 }, '0 results'],
    [SpanType.GRAPH_ACTION, { returned: 3 }, '3 results'],
    [SpanType.WORKFLOW_STEP, { orderId: '123' }, '{"orderId":"123"}'],
  ])('formats recorded domain results for %s', (type, output, expected) => {
    expect(withSpanPreviews(span({ type, output })).outputPreview).toBe(expected);
  });

  it('preserves explicit empty previews and caps explicit text without splitting Unicode', () => {
    expect(
      fields(
        withSpanPreviews(
          span({
            input: 'hidden',
            output: 'hidden',
            errorInfo: { message: 'hidden' },
            inputPreview: '',
            outputPreview: '',
            errorPreview: '',
          }),
        ),
      ),
    ).toEqual({ inputPreview: '', outputPreview: '', errorPreview: '' });
    expect(withSpanPreviews(span({ inputPreview: 'x'.repeat(99) + '😀tail' })).inputPreview).toBe('x'.repeat(99) + '…');
    expect(withSpanPreviews(span({ input: 'visible', inputPreview: null })).inputPreview).toBe('visible');
  });

  it('keeps partial output and error independent, without exposing error stacks or details', () => {
    const result = withSpanPreviews(
      span({
        output: { object: { partial: true } },
        errorInfo: {
          name: 'TimeoutError',
          message: 'Order service timed out',
          stack: 'secret stack',
          details: { token: 'secret' },
        },
      }),
    );
    expect(fields(result)).toEqual({
      inputPreview: '',
      outputPreview: '{"partial":true}',
      errorPreview: 'TimeoutError: Order service timed out',
    });
    expect(withSpanPreviews(span({ errorInfo: { message: '', id: 'ORDER_TIMEOUT' } })).errorPreview).toBe(
      'ORDER_TIMEOUT',
    );
    expect(withSpanPreviews(span({ errorInfo: { message: '', stack: 'secret' } })).errorPreview).toBe('');
    expect(withSpanPreviews(span({ output: { status: 'suspended' } })).errorPreview).toBe('');
  });

  it('falls back to readable payload text when a span-specific field cannot be read', () => {
    const output = { text: 'Order shipped' };
    Object.defineProperty(output, 'object', {
      get() {
        throw new Error('Unreadable structured output');
      },
    });
    const result = withSpanPreviews(span({ output }));
    expect(result.outputPreview).toBe('Order shipped');
    expect(result.output).toBe(output);

    const attributes = {};
    Object.defineProperty(attributes, 'processorPhase', {
      get() {
        throw new Error('Unreadable phase');
      },
    });
    expect(withSpanPreviews(span({ attributes, input: 'Find my order' })).inputPreview).toBe('Find my order');
  });

  it('recovers safe error fields without serializing stack or details when an accessor throws', () => {
    const errorInfo = { message: '', name: 'TimeoutError', stack: 'secret stack', details: { token: 'secret' } };
    Object.defineProperty(errorInfo, 'message', {
      get() {
        throw new Error('Unreadable message');
      },
    });
    expect(withSpanPreviews(span({ errorInfo })).errorPreview).toBe('TimeoutError');
    const messageOnly = { message: 'Order service timed out' };
    Object.defineProperty(messageOnly, 'name', {
      get() {
        throw new Error('Unreadable name');
      },
    });
    expect(withSpanPreviews(span({ errorInfo: messageOnly })).errorPreview).toBe('Order service timed out');
    const unknown = { message: '', stack: 'secret stack', details: { token: 'secret' } };
    Object.defineProperty(unknown, 'message', {
      get() {
        throw new Error('Unreadable message');
      },
    });
    expect(withSpanPreviews(span({ errorInfo: unknown })).errorPreview).toBe('');
  });

  it('bounds large payload traversal and tolerates circular or malformed payloads', () => {
    const output = {
      text: 'a'.repeat(1000),
      get untouched() {
        throw new Error('Should not read this');
      },
    };
    expect(withSpanPreviews(span({ type: SpanType.TOOL_CALL, output })).outputPreview).toBe('a'.repeat(100) + '…');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(withSpanPreviews(span({ type: SpanType.GENERIC, output: circular })).outputPreview).toBe(
      '{"self":"[Circular]"}',
    );
    expect(
      withSpanPreviews(
        span({
          output: {
            get text() {
              throw new Error('Malformed');
            },
          },
        }),
      ).outputPreview,
    ).toBe('');
  });

  it('does not retain a generated empty preview on subsequent snapshots', () => {
    const source = span();
    expect(withSpanPreviews(source).outputPreview).toBe('');
    expect(source).not.toHaveProperty('outputPreview');
    source.output = { text: 'Finished' };
    source.errorInfo = { message: 'Late failure' };
    expect(fields(withSpanPreviews(source))).toEqual({
      inputPreview: '',
      outputPreview: 'Finished',
      errorPreview: 'Late failure',
    });
  });
});

describe.each(['realtime', 'batch-with-updates', 'insert-only'] as const)(
  'exported preview agreement (%s)',
  strategy => {
    it('persists and publishes the same final previews after formatting, including intentional blanks', async () => {
      const received: Array<Record<string, unknown>> = [];
      const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        const parsed = JSON.parse(body);
        received.push(...(parsed.spans ?? []));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{}');
      });
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const storage = new InMemoryStore();
      const mastra = new Mastra({ storage });
      const format = (exported: AnyExportedSpan) =>
        exported.output?.text === 'private' ? { ...exported, output: { text: '[REDACTED]' } } : exported;
      const platform = new MastraPlatformExporter({
        accessToken: 'test-token',
        endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        maxBatchWaitMs: 60_000,
        customSpanFormatter: format,
      });
      const formattedLocal = new MastraStorageExporter({
        strategy,
        maxBatchWaitMs: 60_000,
        customSpanFormatter: format,
      });
      try {
        await formattedLocal.init({ mastra });
        const initial = span({ input: 'Find order', errorPreview: '' });
        await platform.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: initial });
        await platform.exportTracingEvent({ type: TracingEventType.SPAN_UPDATED, exportedSpan: initial });
        await platform.flush();
        expect(received).toEqual([]);
        await formattedLocal.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: initial });
        await formattedLocal.flush();
        const store = await storage.getStore('observability');
        if (strategy !== 'insert-only') {
          expect((await store!.getSpan({ traceId: 'trace', spanId: 'span' }))?.span.outputPreview).toBe('');
        }
        const ended = {
          ...initial,
          endTime: new Date(),
          output: { text: 'private' },
          errorInfo: { message: 'suppressed' },
        };
        const event = { type: TracingEventType.SPAN_ENDED, exportedSpan: ended };
        await formattedLocal.exportTracingEvent(event);
        await platform.exportTracingEvent(event);
        await formattedLocal.flush();
        await platform.flush();
        const stored = await store!.getSpan({ traceId: 'trace', spanId: 'span' });
        expect(fields(stored!.span)).toEqual({
          inputPreview: 'Find order',
          outputPreview: '[REDACTED]',
          errorPreview: '',
        });
        expect(received).toHaveLength(1);
        expect(fields(received[0]!)).toEqual(fields(stored!.span));
        expect(JSON.stringify(received)).not.toContain('private');

        const tracing = new DefaultObservabilityInstance({
          name: 'previews',
          serviceName: 'previews',
          exporters: [formattedLocal, platform],
          spanOutputProcessors: [new SensitiveDataFilter({ sensitiveFields: ['token', 'message'] })],
        });
        const live = tracing.startSpan({
          type: SpanType.TOOL_CALL,
          name: 'redacted tool',
          input: { token: 'private-token' },
        });
        live.update({ output: { token: 'private-token' } });
        live.error({ error: new Error('private-message'), endSpan: true });
        await tracing.flush();
        const redacted = (await store!.getSpan({ traceId: live.traceId, spanId: live.id }))!.span;
        expect(fields(redacted)).toEqual({
          inputPreview: '{"token":"[REDACTED]"}',
          outputPreview: '{"token":"[REDACTED]"}',
          errorPreview: '[REDACTED]',
        });
        expect(fields(received.at(-1)!)).toEqual(fields(redacted));
        expect(JSON.stringify(received.map(fields))).not.toContain('private-');
        await tracing.shutdown();
      } finally {
        await formattedLocal.shutdown();
        await platform.shutdown();
        await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
      }
    });
  },
);
