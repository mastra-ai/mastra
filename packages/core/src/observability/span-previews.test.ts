import { describe, expect, it } from 'vitest';
import { MessageList } from '../agent/message-list';
import { coreFeatures } from '../features';
import { buildSpanPreviews } from './span-previews';
import { SpanType } from './types/tracing';
import type { AnyExportedSpan } from './types/tracing';

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
  it('advertises span preview support', () => {
    expect(coreFeatures.has('observability-span-previews')).toBe(true);
    expect(buildSpanPreviews(span({ output: { text: 'Done' } })).outputPreview).toBe('Done');
  });
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
      expect(buildSpanPreviews(span({ input })).inputPreview).toBe('Where is my order?');
      expect(buildSpanPreviews(span({ type: SpanType.MODEL_STEP, input })).inputPreview).toBe(
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
    expect(buildSpanPreviews(span({ input: [message] })).inputPreview).toBe(expected);
  });

  it('prefers answer text to reasoning and preserves direct signal previews', () => {
    expect(
      buildSpanPreviews(
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
      buildSpanPreviews(span({ input: { __isCreatedSignal: true, type: 'user', contents: 'Check my order' } }))
        .inputPreview,
    ).toBe('Check my order');
  });

  it.each([
    [{ type: 'user', contents: [{ type: 'text', text: 'Find my order' }] }, 'Find my order'],
    [{ type: 'user-message', contents: '' }, ''],
    [
      { type: 'system', tagName: 'skill', attributes: { name: 'orders' }, contents: 'Look up shipping status' },
      'Skill orders: Look up shipping status',
    ],
    [{ type: 'system', tagName: 'skill', attributes: { name: 'orders' }, contents: '' }, 'Skill orders'],
    [{ type: 'system', tagName: 'notice', contents: 'Order updated' }, 'notice: Order updated'],
    [{ type: 'system', contents: 'Order updated' }, 'system: Order updated'],
    [{ contents: 'Order updated' }, 'signal: Order updated'],
    [
      { type: 'system', tagName: 'skill', attributes: { name: 'orders' }, contents: 'x'.repeat(150) },
      'Skill orders: ' + 'x'.repeat(86) + '…',
    ],
  ])('formats created agent signals without relying on storage: %j', (signal, expected) => {
    expect(buildSpanPreviews(span({ input: { __isCreatedSignal: true, ...signal } })).inputPreview).toBe(expected);
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
    expect(buildSpanPreviews(span({ input })).inputPreview).toBe('Original question');
    expect(
      buildSpanPreviews(span({ type: SpanType.MODEL_CHUNK, output: { toolName: 'lookup', toolInput: '{"id":123}' } }))
        .outputPreview,
    ).toBe('lookup: {"id":123}');
  });

  it('applies the storage cap after adding readable labels, including errors', () => {
    const result = buildSpanPreviews(
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
    expect(buildSpanPreviews(span({ input })).inputPreview).toBe('Find my order');
    expect(buildSpanPreviews(span({ type: SpanType.MODEL_STEP, input })).inputPreview).toBe(
      'Tool: Order 123 was shipped',
    );
    expect(buildSpanPreviews(span({ type: SpanType.MODEL_GENERATION, input: { messages: input } })).inputPreview).toBe(
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
    expect(buildSpanPreviews(span({ output })).outputPreview).toBe(expected);
  });

  it('distinguishes resume data from conversation messages', () => {
    expect(
      buildSpanPreviews(
        span({
          metadata: { resumed: true },
          input: {
            toolName: 'approval',
            resumeData: { approved: true },
          },
        }),
      ).inputPreview,
    ).toBe('Resume approval: {"approved":true}');
    expect(buildSpanPreviews(span({ metadata: { resumed: true }, input: 'approved' })).inputPreview).toBe(
      'Resume: approved',
    );
  });

  it('summarizes image-only requests and MCP output without binary data', () => {
    expect(
      buildSpanPreviews(span({ input: [{ role: 'user', content: [{ type: 'image', image: 'secret-base64' }] }] }))
        .inputPreview,
    ).toBe('[image]');
    expect(
      buildSpanPreviews(
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
      buildSpanPreviews(
        span({
          type: SpanType.MEMORY_OPERATION,
          attributes: { processorPhase: 'inputStep' },
          output: { messages: [] },
        }),
      ).outputPreview,
    ).toBe('messages replaced');
    expect(
      buildSpanPreviews(span({ type: SpanType.PROCESSOR_RUN, attributes: { processorPhase: 'input' }, output: {} }))
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
    expect(buildSpanPreviews(span({ type, output })).outputPreview).toBe(expected);
  });

  it('preserves explicit empty previews and caps explicit text without splitting Unicode', () => {
    expect(
      fields(
        buildSpanPreviews(
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
    expect(buildSpanPreviews(span({ inputPreview: 'x'.repeat(99) + '😀tail' })).inputPreview).toBe(
      'x'.repeat(99) + '…',
    );
    expect(buildSpanPreviews(span({ input: 'visible', inputPreview: null })).inputPreview).toBe('visible');
  });

  it('keeps partial output and error independent, without exposing error stacks or details', () => {
    const result = buildSpanPreviews(
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
    expect(buildSpanPreviews(span({ errorInfo: { message: '', id: 'ORDER_TIMEOUT' } })).errorPreview).toBe(
      'ORDER_TIMEOUT',
    );
    expect(buildSpanPreviews(span({ errorInfo: { message: '', stack: 'secret' } })).errorPreview).toBe('');
    expect(buildSpanPreviews(span({ output: { status: 'suspended' } })).errorPreview).toBe('');
  });

  it('falls back to readable payload text when a span-specific field cannot be read', () => {
    const output = { text: 'Order shipped' };
    Object.defineProperty(output, 'object', {
      get() {
        throw new Error('Unreadable structured output');
      },
    });
    const result = buildSpanPreviews(span({ output }));
    expect(result.outputPreview).toBe('Order shipped');
    expect(output.text).toBe('Order shipped');

    const attributes = {};
    Object.defineProperty(attributes, 'processorPhase', {
      get() {
        throw new Error('Unreadable phase');
      },
    });
    expect(buildSpanPreviews(span({ attributes, input: 'Find my order' })).inputPreview).toBe('Find my order');
  });

  it('recovers safe error fields without serializing stack or details when an accessor throws', () => {
    const errorInfo = { message: '', name: 'TimeoutError', stack: 'secret stack', details: { token: 'secret' } };
    Object.defineProperty(errorInfo, 'message', {
      get() {
        throw new Error('Unreadable message');
      },
    });
    expect(buildSpanPreviews(span({ errorInfo })).errorPreview).toBe('TimeoutError');
    const messageOnly = { message: 'Order service timed out' };
    Object.defineProperty(messageOnly, 'name', {
      get() {
        throw new Error('Unreadable name');
      },
    });
    expect(buildSpanPreviews(span({ errorInfo: messageOnly })).errorPreview).toBe('Order service timed out');
    const unknown = { message: '', stack: 'secret stack', details: { token: 'secret' } };
    Object.defineProperty(unknown, 'message', {
      get() {
        throw new Error('Unreadable message');
      },
    });
    expect(buildSpanPreviews(span({ errorInfo: unknown })).errorPreview).toBe('');
  });

  it('bounds large payload traversal and tolerates circular or malformed payloads', () => {
    const output = {
      text: 'a'.repeat(1000),
      get untouched() {
        throw new Error('Should not read this');
      },
    };
    expect(buildSpanPreviews(span({ type: SpanType.TOOL_CALL, output })).outputPreview).toBe('a'.repeat(100) + '…');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(buildSpanPreviews(span({ type: SpanType.GENERIC, output: circular })).outputPreview).toBe(
      '{"self":"[Circular]"}',
    );
    expect(
      buildSpanPreviews(
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
    expect(buildSpanPreviews(source).outputPreview).toBe('');
    expect(source).not.toHaveProperty('outputPreview');
    source.output = { text: 'Finished' };
    source.errorInfo = { message: 'Late failure' };
    expect(fields(buildSpanPreviews(source))).toEqual({
      inputPreview: '',
      outputPreview: 'Finished',
      errorPreview: 'Late failure',
    });
  });
});
