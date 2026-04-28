import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';

import { isModelNotAllowedError, MASTRA_BUILDER_MODEL_POLICY_KEY } from '../agent-builder/ee';
import { noopLogger } from '../logger';
import { RequestContext } from '../request-context';
import { Agent } from './index';

const makeMockModel = (provider: string, modelId: string) =>
  new MockLanguageModelV2({
    modelId,
    provider,
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text: 'ok' }],
      warnings: [],
    }),
  });

describe('Phase 7 — Agent runtime model-policy enforcement', () => {
  it('passes through when no policy is seeded (regression guard)', async () => {
    const agent = new Agent({
      id: 'no-policy',
      name: 'no-policy',
      instructions: 'test',
      model: makeMockModel('openai', 'gpt-4o-mini') as any,
    });
    agent.__setLogger(noopLogger);

    const ctx = new RequestContext();
    await expect(agent.getModel({ requestContext: ctx })).resolves.toBeDefined();
  });

  it('passes through when policy.active === false', async () => {
    const agent = new Agent({
      id: 'inactive-policy',
      name: 'inactive-policy',
      instructions: 'test',
      model: makeMockModel('openai', 'gpt-4o-mini') as any,
    });
    agent.__setLogger(noopLogger);

    const ctx = new RequestContext();
    ctx.set(MASTRA_BUILDER_MODEL_POLICY_KEY, { active: false });

    await expect(agent.getModel({ requestContext: ctx })).resolves.toBeDefined();
  });

  it('passes through when allowed list is empty (unrestricted)', async () => {
    const agent = new Agent({
      id: 'empty-allowed',
      name: 'empty-allowed',
      instructions: 'test',
      model: makeMockModel('openai', 'gpt-4o-mini') as any,
    });
    agent.__setLogger(noopLogger);

    const ctx = new RequestContext();
    ctx.set(MASTRA_BUILDER_MODEL_POLICY_KEY, { active: true, allowed: [] });

    await expect(agent.getModel({ requestContext: ctx })).resolves.toBeDefined();
  });

  it('rejects when a DynamicArgument resolves to a disallowed model', async () => {
    const agent = new Agent({
      id: 'dynamic-disallowed',
      name: 'dynamic-disallowed',
      instructions: 'test',
      model: () => makeMockModel('anthropic', 'claude-3-opus-20240229') as any,
    });
    agent.__setLogger(noopLogger);

    const ctx = new RequestContext();
    ctx.set(MASTRA_BUILDER_MODEL_POLICY_KEY, {
      active: true,
      allowed: [{ kind: 'known', provider: 'openai' }],
    });

    let caught: unknown;
    try {
      await agent.getModel({ requestContext: ctx });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isModelNotAllowedError(caught)).toBe(true);
  });

  it('passes when DynamicArgument resolves to an allowed model', async () => {
    const agent = new Agent({
      id: 'dynamic-allowed',
      name: 'dynamic-allowed',
      instructions: 'test',
      model: () => makeMockModel('openai', 'gpt-4o-mini') as any,
    });
    agent.__setLogger(noopLogger);

    const ctx = new RequestContext();
    ctx.set(MASTRA_BUILDER_MODEL_POLICY_KEY, {
      active: true,
      allowed: [{ kind: 'known', provider: 'openai' }],
    });

    await expect(agent.getModel({ requestContext: ctx })).resolves.toBeDefined();
  });

  it('rejects on the first disallowed entry of a fallback array', async () => {
    const agent = new Agent({
      id: 'fallback-array',
      name: 'fallback-array',
      instructions: 'test',
      model: () => [
        { id: 'good', model: makeMockModel('openai', 'gpt-4o-mini') as any, maxRetries: 0, enabled: true },
        {
          id: 'bad',
          model: makeMockModel('anthropic', 'claude-3-opus-20240229') as any,
          maxRetries: 0,
          enabled: true,
        },
      ],
    });
    agent.__setLogger(noopLogger);

    const ctx = new RequestContext();
    ctx.set(MASTRA_BUILDER_MODEL_POLICY_KEY, {
      active: true,
      allowed: [{ kind: 'known', provider: 'openai' }],
    });

    let caught: unknown;
    try {
      await agent.getModel({ requestContext: ctx });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isModelNotAllowedError(caught)).toBe(true);
  });
});
