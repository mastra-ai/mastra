import { createSignal } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';
import {
  agentExecutionBodySchema,
  agentExecutionLegacyBodySchema,
  listPendingSignalsResponseSchema,
  removePendingSignalsBodySchema,
  resumeStreamBodySchema,
} from './agents';

describe('bulk pending signal removal input', () => {
  it.each([undefined, null, 'sig-1', [], [''], [42], Array(1001).fill('sig-1')])(
    'rejects invalid signal IDs (case %#)',
    signalIds => {
      expect(removePendingSignalsBodySchema.safeParse({ signalIds }).success).toBe(false);
    },
  );

  it('accepts single, multiple, duplicate IDs, and the maximum batch size', () => {
    for (const signalIds of [['sig-1'], ['sig-1', 'sig-2'], ['sig-1', 'sig-1'], Array(1000).fill('sig-1')]) {
      expect(removePendingSignalsBodySchema.parse({ signalIds })).toEqual({ signalIds });
    }
  });
});

describe('pending signal response contents', () => {
  it('preserves serialized text and multimodal signals, including provider options', () => {
    const contents = [
      { type: 'text' as const, text: 'Review this file', providerOptions: { openai: { detail: 'high' } } },
      { type: 'file' as const, data: new Uint8Array([104, 105]), mediaType: 'text/plain', filename: 'note.txt' },
    ];
    const signals = [createSignal({ type: 'user', contents: 'hello' }), createSignal({ type: 'user', contents })].map(
      signal => ({ scope: 'pending' as const, signal: signal.toDataPart().data }),
    );
    expect(listPendingSignalsResponseSchema.parse({ signals })).toEqual({ signals });
    expect(signals[1]!.signal.contents).toContainEqual({
      type: 'file',
      data: 'aGk=',
      mediaType: 'text/plain',
      filename: 'note.txt',
    });
  });

  it.each([
    null,
    42,
    { text: 'not a part array' },
    [{ type: 'text' }],
    [{ type: 'file', data: 42, mediaType: 'text/plain' }],
  ])('rejects invalid signal contents %j', contents => {
    expect(
      listPendingSignalsResponseSchema.safeParse({
        signals: [
          {
            scope: 'pending',
            signal: {
              id: 'signal',
              type: 'user',
              createdAt: new Date(0).toISOString(),
              contents,
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('agent execution providerOptions', () => {
  const providerOptions = {
    deepseek: { thinking: { type: 'disabled' } },
    bedrock: { reasoningConfig: { type: 'enabled', budgetTokens: 1024 } },
    groq: { reasoningFormat: 'hidden' },
    'custom-provider': { nested: { values: [null, true, 42, 'value', { enabled: false }] } },
    anthropic: { thinking: { type: 'disabled' } },
    google: { thinkingConfig: { includeThoughts: false } },
    openai: { reasoningEffort: 'low' },
    xai: { reasoningEffort: 'low' },
  };

  it.each([
    ['execution', agentExecutionBodySchema, { messages: 'hello' }],
    ['legacy', agentExecutionLegacyBodySchema, { messages: 'hello', threadId: 'thread', resourceId: 'resource' }],
    ['resume', resumeStreamBodySchema, { runId: 'run', resumeData: {} }],
  ] as const)('preserves all provider namespaces in %s requests', (_name, schema, body) => {
    expect(schema.parse({ ...body, providerOptions }).providerOptions).toEqual(providerOptions);
  });

  it('accepts omitted and empty options', () => {
    expect(agentExecutionBodySchema.parse({ messages: 'hello' }).providerOptions).toBeUndefined();
    expect(agentExecutionBodySchema.parse({ messages: 'hello', providerOptions: {} }).providerOptions).toEqual({});
  });

  it('preserves additional top-level fields', () => {
    expect(agentExecutionBodySchema.parse({ messages: 'hello', custom: true })).toHaveProperty('custom', true);
  });

  it.each([null, 'invalid', 42, true, []].map(value => ({ value })))(
    'rejects invalid namespace value $value',
    ({ value }) => {
      expect(
        agentExecutionBodySchema.safeParse({ messages: 'hello', providerOptions: { deepseek: value } }).success,
      ).toBe(false);
    },
  );

  it.each([undefined, () => {}, new Date(), Number.NaN, Infinity])('rejects non-JSON option value %s', value => {
    expect(
      agentExecutionBodySchema.safeParse({ messages: 'hello', providerOptions: { openai: { value } } }).success,
    ).toBe(false);
  });
});
