import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ProviderAddedCosts, providerAddedKey, readReportedProviderAdded } from '../fixed-prompt-cost';

const tools = {
  read: createTool({
    id: 'read',
    description: 'Read a file',
    inputSchema: z.object({ path: z.string() }),
    execute: async () => 'ok',
  }),
  search: createTool({
    id: 'search',
    description: 'Search files',
    inputSchema: z.object({ pattern: z.string() }),
    execute: async () => 'ok',
  }),
};
const base = {
  model: 'openai.responses/gpt-5',
  tools,
  activeTools: undefined,
  toolChoice: 'auto',
  providerOptions: { openai: { store: false, reasoningEffort: 'low' } },
};

describe('provider-added prompt key', () => {
  it('is stable for the same request configuration, whatever order options were written in', () => {
    expect(providerAddedKey(base)).toBe(providerAddedKey({ ...base }));
    expect(providerAddedKey(base)).toBe(
      providerAddedKey({ ...base, providerOptions: { openai: { reasoningEffort: 'low', store: false } } }),
    );
  });

  it('changes with the model, the tool definitions, the active tools, the tool choice or the options', () => {
    const key = providerAddedKey(base);
    const renamed = {
      ...tools,
      read: createTool({
        id: 'read',
        description: 'Read a whole file',
        inputSchema: z.object({ path: z.string() }),
        execute: async () => 'ok',
      }),
    };
    for (const changed of [
      { ...base, model: 'openai.responses/gpt-5-mini' },
      { ...base, tools: renamed },
      { ...base, activeTools: ['read'] },
      { ...base, toolChoice: 'required' },
      { ...base, providerOptions: { openai: { store: false, reasoningEffort: 'high' } } },
    ])
      expect(providerAddedKey(changed)).not.toBe(key);
  });

  it('never holds credentials', () => {
    const key = providerAddedKey({ ...base, providerOptions: { openai: { store: false } } });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('reported provider-added prompt', () => {
  const usage = (requestFields: unknown) => ({
    inputTokens: 300,
    outputTokens: 10,
    raw: { raw: { attribution: { request_fields: requestFields } } },
  });

  it('sums the instructions and tools fields the provider reports', () => {
    expect(readReportedProviderAdded(usage({ instructions: { input_tokens: 53 }, tools: { input_tokens: 69 } }))).toBe(
      122,
    );
  });

  it('leaves message, reasoning and unknown fields out of the provider-added cost', () => {
    expect(
      readReportedProviderAdded(
        usage({
          instructions: { input_tokens: 53 },
          tools: { input_tokens: 69 },
          messages: { input_tokens: 5000 },
          reasoning: { input_tokens: 4000 },
          some_new_field: { input_tokens: 3000 },
        }),
      ),
    ).toBe(122);
    expect(readReportedProviderAdded(usage({ messages: { input_tokens: 5000 } }))).toBeUndefined();
  });

  it('is unknown when there is no split or a field has no count', () => {
    expect(readReportedProviderAdded({ inputTokens: 300, outputTokens: 10 })).toBeUndefined();
    expect(readReportedProviderAdded(usage({}))).toBeUndefined();
    expect(readReportedProviderAdded(usage({ tools: { input_tokens: Number.NaN } }))).toBeUndefined();
    expect(readReportedProviderAdded(usage({ tools: {} }))).toBeUndefined();
  });
});

describe('provider-added prompt cache', () => {
  it('lets a reported value replace a first-step one, never the other way round', () => {
    const costs = new ProviderAddedCosts();
    costs.record('k', { tokens: 400, source: 'first-step' });
    costs.record('k', { tokens: 122, source: 'reported' });
    expect(costs.get('k')).toEqual({ tokens: 122, source: 'reported' });
    costs.record('k', { tokens: 999, source: 'first-step' });
    expect(costs.get('k')).toEqual({ tokens: 122, source: 'reported' });
  });

  it('keeps the first first-step measurement', () => {
    const costs = new ProviderAddedCosts();
    costs.record('k', { tokens: 400, source: 'first-step' });
    costs.record('k', { tokens: 9_000, source: 'first-step' });
    expect(costs.get('k')?.tokens).toBe(400);
  });

  it('holds at most 64 configurations, dropping the least recently used', () => {
    const costs = new ProviderAddedCosts();
    for (let i = 0; i < 64; i++) costs.record(`k${i}`, { tokens: i, source: 'first-step' });
    costs.get('k0');
    costs.record('k64', { tokens: 64, source: 'first-step' });
    expect(costs.get('k0')?.tokens).toBe(0);
    expect(costs.get('k1')).toBeUndefined();
    expect(costs.get('k64')?.tokens).toBe(64);
  });
});
