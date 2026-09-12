const { appDataDir, previousEnv } = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? '/tmp'}/mastracode-model-kimi-${process.pid}`;
  const previous = {
    appDataDir: process.env.MASTRA_APP_DATA_DIR,
    kimiApiKey: process.env.KIMI_API_KEY,
    mastraGatewayApiKey: process.env.MASTRA_GATEWAY_API_KEY,
  };
  process.env.MASTRA_APP_DATA_DIR = dir;
  return { appDataDir: dir, previousEnv: previous };
});

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MastraGateway } from '@mastra/core/llm';
import { RequestContext } from '@mastra/core/request-context';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { MastraCodeGateway } from './mastracode-gateway.js';
import { getDynamicModel, resolveModel } from './model.js';

afterEach(() => {
  if (previousEnv.kimiApiKey === undefined) delete process.env.KIMI_API_KEY;
  else process.env.KIMI_API_KEY = previousEnv.kimiApiKey;
  if (previousEnv.mastraGatewayApiKey === undefined) delete process.env.MASTRA_GATEWAY_API_KEY;
  else process.env.MASTRA_GATEWAY_API_KEY = previousEnv.mastraGatewayApiKey;
  vi.restoreAllMocks();
});

afterAll(() => {
  if (previousEnv.appDataDir === undefined) delete process.env.MASTRA_APP_DATA_DIR;
  else process.env.MASTRA_APP_DATA_DIR = previousEnv.appDataDir;
  rmSync(appDataDir, { recursive: true, force: true });
});

describe('getDynamicModel error branches', () => {
  it('points at the missing controller context when the run has no session request context at all', () => {
    const requestContext = new RequestContext();
    expect(() => getDynamicModel({ requestContext })).toThrow(
      'No model available: this run started without a controller session context, so no model selection could be resolved.',
    );
  });

  it('keeps the /models guidance when a controller context exists but has no model selected', () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', { session: { modelId: '' } });
    expect(() => getDynamicModel({ requestContext })).toThrow(
      'No model selected. Use /models to select a model first.',
    );
  });
});

describe('getDynamicModel fallback chain', () => {
  function seedSettings(packFallbacks: Record<string, string>) {
    mkdirSync(appDataDir, { recursive: true });
    writeFileSync(
      join(appDataDir, 'settings.json'),
      JSON.stringify({
        onboarding: { completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null, version: 1 },
        models: { packFallbacks },
      }),
      'utf-8',
    );
  }

  function requestWithSession(modelId: string, modeId = 'build') {
    const requestContext = new RequestContext();
    requestContext.set('controller', { session: { modelId, modeId } });
    return { requestContext };
  }

  it('returns a bare model when no fallback is configured — identical to before', () => {
    seedSettings({});

    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5'));

    expect(Array.isArray(model)).toBe(false);
    expect((model as { modelId?: string }).modelId).toBe('claude-fable-5');
  });

  it('returns a bare model for a manual /model selection that matches no pack', () => {
    seedSettings({ anthropic: 'openai' });

    const model = getDynamicModel(requestWithSession('openai/gpt-5.4-mini'));

    expect(Array.isArray(model)).toBe(false);
  });

  it('builds the fallback array from the active pack chain, resolving each pack for the same mode', () => {
    seedSettings({ anthropic: 'openai', openai: 'github-copilot' });

    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5'));

    expect(Array.isArray(model)).toBe(true);
    const entries = model as Array<{ id?: string; model: { modelId?: string } }>;
    expect(entries.map(entry => entry.id)).toEqual(['anthropic', 'openai', 'github-copilot']);
    expect(entries.map(entry => entry.model.modelId)).toEqual(['claude-fable-5', 'gpt-5.6-sol', 'gpt-4.1']);
  });

  it('gives a revisited pack a unique per-occurrence id (A→B→A chain)', () => {
    seedSettings({ anthropic: 'openai', openai: 'anthropic' });

    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5'));
    const entries = model as Array<{ id?: string }>;

    // Each pack appears at most twice (initial visit + one revisit).
    expect(entries.map(entry => entry.id)).toEqual(['anthropic', 'openai', 'anthropic#2', 'openai#2']);
  });

  it('identifies the pack through builtin overrides applied to the session model', () => {
    seedSettings({ anthropic: 'openai' });
    const raw = JSON.parse(readFileSync(join(appDataDir, 'settings.json'), 'utf-8'));
    raw.models.modePackOverrides = { anthropic: { build: 'anthropic/claude-haiku-4-5' } };
    writeFileSync(join(appDataDir, 'settings.json'), JSON.stringify(raw), 'utf-8');

    const model = getDynamicModel(requestWithSession('anthropic/claude-haiku-4-5'));

    expect(Array.isArray(model)).toBe(true);
    expect((model as Array<{ id?: string }>).map(entry => entry.id)).toEqual(['anthropic', 'openai']);
  });
});

describe('resolveModel Kimi For Coding authentication', () => {
  it('delegates an explicit Mastra Gateway model without selecting the direct Kimi transport', () => {
    process.env.MASTRA_GATEWAY_API_KEY = 'msk-gateway-key';
    const delegatedModel = { provider: 'mastra-gateway' };
    const gatewaySpy = vi
      .spyOn(MastraGateway.prototype, 'resolveLanguageModel')
      .mockReturnValue(delegatedModel as ReturnType<MastraGateway['resolveLanguageModel']>);

    const model = resolveModel('mastra/kimi-for-coding/k3');

    expect(model).toBe(delegatedModel);
    expect(gatewaySpy).toHaveBeenCalledWith({
      providerId: 'kimi-for-coding',
      modelId: 'k3',
      apiKey: 'msk-gateway-key',
      headers: undefined,
    });
  });

  it('passes KIMI_API_KEY into direct Kimi model resolution', () => {
    process.env.KIMI_API_KEY = 'kimi-env-key';
    const resolveSpy = vi.spyOn(MastraCodeGateway.prototype, 'resolveLanguageModel');

    resolveModel('kimi-for-coding/k3');

    expect(resolveSpy).toHaveBeenCalledWith({
      providerId: 'kimi-for-coding',
      modelId: 'k3',
      apiKey: 'kimi-env-key',
      headers: undefined,
    });
  });
});
