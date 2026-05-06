import { describe, expect, it } from 'vitest';
import { buildAgentResponseCacheKey, resolveResponseCacheConfig, summarizeToolsForCacheKey } from './response-cache';

describe('resolveResponseCacheConfig', () => {
  it('returns disabled when both agent and per-call are undefined', () => {
    expect(resolveResponseCacheConfig(undefined, undefined)).toEqual({ enabled: false, bust: false });
  });

  it('returns disabled when per-call is explicitly false even if agent default is true', () => {
    expect(resolveResponseCacheConfig(true, false)).toEqual({ enabled: false, bust: false });
    expect(resolveResponseCacheConfig({ ttl: 10 }, false)).toEqual({ enabled: false, bust: false });
  });

  it('enables when agent default is true and per-call is undefined', () => {
    expect(resolveResponseCacheConfig(true, undefined)).toMatchObject({ enabled: true, bust: false });
  });

  it('enables when per-call is true', () => {
    expect(resolveResponseCacheConfig(undefined, true)).toMatchObject({ enabled: true, bust: false });
  });

  it('merges agent defaults under per-call object', () => {
    const merged = resolveResponseCacheConfig({ ttl: 60, scope: 'agent-scope' }, { ttl: 120, key: 'override-key' });
    expect(merged).toMatchObject({
      enabled: true,
      ttl: 120,
      key: 'override-key',
      scope: 'agent-scope',
      bust: false,
    });
  });

  it('per-call scope null overrides agent-level scope', () => {
    const merged = resolveResponseCacheConfig({ scope: 'agent-scope' }, { scope: null });
    expect(merged.scope).toBeNull();
  });

  it('per-call bust=true is honored', () => {
    expect(resolveResponseCacheConfig(true, { bust: true })).toMatchObject({ enabled: true, bust: true });
  });

  it('preserves function-form key from agent default and per-call override', () => {
    const agentKeyFn = () => 'agent-key';
    const perCallKeyFn = () => 'per-call-key';
    expect(resolveResponseCacheConfig({ key: agentKeyFn }, undefined).key).toBe(agentKeyFn);
    expect(resolveResponseCacheConfig({ key: agentKeyFn }, { key: perCallKeyFn }).key).toBe(perCallKeyFn);
  });
});

describe('buildAgentResponseCacheKey', () => {
  const baseInputs = {
    agentId: 'test-agent',
    methodType: 'stream' as const,
    model: { provider: 'openai', modelId: 'gpt-5', specVersion: 'v3' },
    instructions: 'You are helpful',
    messages: 'Hello world',
  };

  it('produces a deterministic key for identical inputs', () => {
    const k1 = buildAgentResponseCacheKey(baseInputs);
    const k2 = buildAgentResponseCacheKey({ ...baseInputs });
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^mastra:agent-response:test-agent:stream:[0-9a-f]+$/);
  });

  it('produces different keys for different models', () => {
    const k1 = buildAgentResponseCacheKey(baseInputs);
    const k2 = buildAgentResponseCacheKey({
      ...baseInputs,
      model: { ...baseInputs.model, modelId: 'gpt-4o' },
    });
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different providers (same modelId)', () => {
    const k1 = buildAgentResponseCacheKey(baseInputs);
    const k2 = buildAgentResponseCacheKey({
      ...baseInputs,
      model: { ...baseInputs.model, provider: 'anthropic' },
    });
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different messages', () => {
    const k1 = buildAgentResponseCacheKey(baseInputs);
    const k2 = buildAgentResponseCacheKey({ ...baseInputs, messages: 'Different prompt' });
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different instructions', () => {
    const k1 = buildAgentResponseCacheKey(baseInputs);
    const k2 = buildAgentResponseCacheKey({ ...baseInputs, instructions: 'Be concise' });
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different model settings', () => {
    const k1 = buildAgentResponseCacheKey({ ...baseInputs, modelSettings: { temperature: 0.7 } });
    const k2 = buildAgentResponseCacheKey({ ...baseInputs, modelSettings: { temperature: 0.2 } });
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for stream vs generate', () => {
    const k1 = buildAgentResponseCacheKey(baseInputs);
    const k2 = buildAgentResponseCacheKey({ ...baseInputs, methodType: 'generate' });
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different scopes', () => {
    const k1 = buildAgentResponseCacheKey({ ...baseInputs, scope: 'user-1' });
    const k2 = buildAgentResponseCacheKey({ ...baseInputs, scope: 'user-2' });
    expect(k1).not.toBe(k2);
  });

  it('is order-independent for object property ordering', () => {
    const k1 = buildAgentResponseCacheKey({
      ...baseInputs,
      modelSettings: { temperature: 0.7, maxTokens: 100 },
    });
    const k2 = buildAgentResponseCacheKey({
      ...baseInputs,
      modelSettings: { maxTokens: 100, temperature: 0.7 },
    });
    expect(k1).toBe(k2);
  });

  it('produces different keys for different tool definitions', () => {
    const k1 = buildAgentResponseCacheKey({
      ...baseInputs,
      tools: { agent: { weather: { description: 'Get weather' } } },
    });
    const k2 = buildAgentResponseCacheKey({
      ...baseInputs,
      tools: { agent: { weather: { description: 'Get the current weather' } } },
    });
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different structured output schemas', () => {
    const k1 = buildAgentResponseCacheKey({
      ...baseInputs,
      structuredOutputSchema: { type: 'object', properties: { a: { type: 'string' } } },
    });
    const k2 = buildAgentResponseCacheKey({
      ...baseInputs,
      structuredOutputSchema: { type: 'object', properties: { b: { type: 'number' } } },
    });
    expect(k1).not.toBe(k2);
  });
});

describe('summarizeToolsForCacheKey', () => {
  it('returns null for missing/empty tools', () => {
    expect(summarizeToolsForCacheKey(undefined)).toBeNull();
    expect(summarizeToolsForCacheKey(null)).toBeNull();
  });

  it('extracts only the cache-relevant fields, in deterministic order', () => {
    const tools = {
      bbb: { description: 'B', inputSchema: { type: 'object' }, execute: () => null },
      aaa: { description: 'A', parameters: { type: 'string' }, somePrivateField: 'ignored' },
    };
    const summary = summarizeToolsForCacheKey(tools);
    expect(Object.keys(summary as Record<string, unknown>)).toEqual(['aaa', 'bbb']);
    expect(summary).toMatchObject({
      aaa: { description: 'A', inputSchema: { type: 'string' } },
      bbb: { description: 'B', inputSchema: { type: 'object' } },
    });
    expect((summary as Record<string, Record<string, unknown>>).aaa.somePrivateField).toBeUndefined();
    expect((summary as Record<string, Record<string, unknown>>).bbb.execute).toBeUndefined();
  });
});
