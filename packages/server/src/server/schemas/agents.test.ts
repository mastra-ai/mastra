import { describe, expect, it } from 'vitest';
import { agentExecutionBodySchema, agentExecutionLegacyBodySchema, resumeStreamBodySchema } from './agents';

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
