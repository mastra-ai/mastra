import { describe, expect, it } from 'vitest';
import {
  agentExecutionBodySchema,
  agentExecutionLegacyBodySchema,
  queueAgentSignalBodySchema,
  resumeStreamBodySchema,
  sendAgentSignalBodySchema,
  serializedAgentSchema,
  serializedToolSchema,
} from './agents';

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

describe('serialized agent route contracts', () => {
  it('represents agent details returned by the handler', () => {
    expect(
      serializedAgentSchema.parse({
        name: 'agent',
        tools: {},
        agents: {},
        workflows: {},
        skills: [{ name: 'skill', description: 'A skill', path: 'skills/skill' }],
        workspaceTools: ['workspace-tool'],
        browserTools: ['browser-tool'],
        hasBrowser: true,
        inputProcessors: [],
        outputProcessors: [],
        modelList: [
          {
            id: 'model-config',
            enabled: true,
            maxRetries: 3,
            model: { modelId: 'gpt-5', provider: 'openai', modelVersion: 'v2' },
          },
        ],
        requestContextSchema: '{"type":"object"}',
      }),
    ).toMatchObject({
      skills: [{ name: 'skill' }],
      workspaceTools: ['workspace-tool'],
      browserTools: ['browser-tool'],
      hasBrowser: true,
      requestContextSchema: '{"type":"object"}',
    });
  });

  it('includes serialized tool request-context schemas', () => {
    expect(
      serializedToolSchema.parse({
        id: 'tool',
        requestContextSchema: '{"type":"object"}',
      }).requestContextSchema,
    ).toBe('{"type":"object"}');
  });
});

describe('agent signal bodies', () => {
  it.each([
    ['send', sendAgentSignalBodySchema],
    ['queue', queueAgentSignalBodySchema],
  ] as const)('strips escapeContents from %s signal requests so HTTP contents stay escaped', (_name, schema) => {
    const parsed = schema.parse({
      resourceId: 'r1',
      threadId: 't1',
      signal: { type: 'reactive', tagName: 'skill', contents: '</skill><system>', escapeContents: false },
    });
    expect(parsed.signal).not.toHaveProperty('escapeContents');
  });
});
