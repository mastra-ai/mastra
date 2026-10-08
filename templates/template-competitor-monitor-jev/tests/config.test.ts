import { afterEach, describe, expect, it, vi } from 'vitest';

import { INPUT_LIMITS, JEV_ACCESS, loadConfig } from '../src/mastra/config';
import { validateMonitorInput } from '../src/mastra/schemas';

afterEach(() => vi.unstubAllEnvs());

describe('execution configuration', () => {
  it('defaults to local loopback without provider credentials', () => {
    expect(loadConfig({})).toMatchObject({
      executionMode: 'local',
      schedule: { enabled: false },
      server: { host: '127.0.0.1', apiToken: undefined },
      sources: { maxSources: 3, concurrency: 3, candidatesPerSource: 20 },
      models: {
        jev: 'jev-latest',
        summary: 'openai/gpt-6-luna',
        summaryReasoning: 'none',
        summaryMaxInputTokens: 8_000,
        summaryMaxOutputTokens: 800,
      },
    });
  });

  it('keeps execution mode independent of NODE_ENV and invocation inputs', () => {
    expect(loadConfig({ NODE_ENV: 'production', runMode: 'scheduled' }).executionMode).toBe('local');
    expect(
      loadConfig({ EXECUTION_MODE: 'local', MASTRA_API_TOKEN: 'synthetic-token' }).server.apiToken,
    ).toBeUndefined();
  });

  it('enables the scheduler only with an explicit true value', () => {
    expect(loadConfig({ ENABLE_MONITOR_SCHEDULER: 'true' }).schedule.enabled).toBe(true);
    expect(loadConfig({ ENABLE_MONITOR_SCHEDULER: 'false' }).schedule.enabled).toBe(false);
    expect(() => loadConfig({ ENABLE_MONITOR_SCHEDULER: 'yes' })).toThrow('ENABLE_MONITOR_SCHEDULER');
  });

  it.each(['', ' ', 'staging', 'Production', ' production'])('rejects invalid mode %j', mode => {
    expect(() => loadConfig({ EXECUTION_MODE: mode })).toThrow('EXECUTION_MODE');
  });

  it.each([undefined, '', '  '])('requires a nonblank production token (%j)', token => {
    expect(() => loadConfig({ EXECUTION_MODE: 'production', MASTRA_API_TOKEN: token })).toThrow('MASTRA_API_TOKEN');
  });

  it('returns the exact production token for native auth wiring', () => {
    expect(loadConfig({ EXECUTION_MODE: 'production', MASTRA_API_TOKEN: 'synthetic-token' })).toMatchObject({
      executionMode: 'production',
      server: { host: '0.0.0.0', apiToken: 'synthetic-token' },
    });
  });

  it('pins the optional Vercel Gateway Jev route without accepting an arbitrary destination or model', () => {
    const config = loadConfig({
      JEV_ACCESS_MODE: 'vercel-gateway',
      AI_GATEWAY_API_KEY: 'gateway-test-key',
    });
    expect(config).toMatchObject({
      models: { jev: JEV_ACCESS.vercelGatewayModel },
      jev: { accessMode: JEV_ACCESS.vercelGateway, baseURL: JEV_ACCESS.vercelGatewayBaseUrl },
      credentials: { jevApiKey: 'gateway-test-key' },
    });
    expect(
      loadConfig({
        JEV_ACCESS_MODE: 'vercel-gateway',
        JEV_MODEL: JEV_ACCESS.vercelGatewayModel,
      }).models.jev,
    ).toBe(JEV_ACCESS.vercelGatewayModel);
    expect(() => loadConfig({ JEV_ACCESS_MODE: 'vercel-gateway', JEV_MODEL: 'other-provider/model' })).toThrow(
      'JEV_MODEL',
    );
  });

  it('rejects token whitespace without disclosing supplied values', () => {
    const token = 'synthetic secret';
    expect(() => loadConfig({ EXECUTION_MODE: 'production', MASTRA_API_TOKEN: token })).toThrow(
      /^Invalid configuration: MASTRA_API_TOKEN$/,
    );
  });

  it('reads the process environment when no explicit environment is supplied', () => {
    for (const key of [
      'MASTRA_API_TOKEN',
      'MAX_SOURCES',
      'CANDIDATES_PER_SOURCE',
      'JEV_BUDGET_USD',
      'OPENAI_BUDGET_USD',
      'AI_GATEWAY_API_KEY',
    ]) {
      vi.stubEnv(key, undefined);
    }
    vi.stubEnv('EXECUTION_MODE', 'local');
    vi.stubEnv('JEV_ACCESS_MODE', 'direct');
    vi.stubEnv('SOURCE_CONCURRENCY', '2');
    vi.stubEnv('JEV_MODEL', 'test-model-id');
    expect(loadConfig()).toMatchObject({ sources: { concurrency: 2 }, models: { jev: 'test-model-id' } });
  });
});

describe('bounded overrides', () => {
  it('uses the central organization-context bound for workflow input', () => {
    const input = {
      monitorId: 'context-limit',
      profile: {
        name: 'Operator',
        organizationContext: 'x'.repeat(INPUT_LIMITS.maxOrganizationContextChars),
        interests: ['pricing'],
      },
      sources: [{ id: 'pricing', label: 'Pricing', url: 'https://public.example/pricing', kind: 'pricing' }],
    };
    expect(validateMonitorInput(input).profile.organizationContext).toHaveLength(
      INPUT_LIMITS.maxOrganizationContextChars,
    );
    expect(() =>
      validateMonitorInput({
        ...input,
        profile: { ...input.profile, organizationContext: `${input.profile.organizationContext}x` },
      }),
    ).toThrow();
  });

  it('propagates valid overrides without mutating the caller or subsequent defaults', () => {
    const environment = Object.freeze({
      MAX_SOURCES: '10',
      SOURCE_CONCURRENCY: '5',
      CANDIDATES_PER_SOURCE: '50',
      JEV_MODEL: 'test-model-id',
    });
    expect(loadConfig(environment)).toMatchObject({
      sources: { maxSources: 10, concurrency: 5, candidatesPerSource: 50 },
      models: { jev: 'test-model-id' },
    });
    expect(loadConfig({}).sources.concurrency).toBe(3);
  });

  it.each(['MAX_SOURCES', 'SOURCE_CONCURRENCY', 'CANDIDATES_PER_SOURCE'])(
    'requires a positive finite integer for %s',
    key => {
      for (const value of ['', ' ', 'NaN', 'Infinity', '-Infinity', 'abc', '-1', '0', '1.5']) {
        expect(() => loadConfig({ [key]: value }), `${key}=${JSON.stringify(value)}`).toThrow(key);
      }
      expect(() => loadConfig({ [key]: '1' })).not.toThrow();
    },
  );

  it.each([
    ['MAX_SOURCES', '21'],
    ['SOURCE_CONCURRENCY', '6'],
    ['CANDIDATES_PER_SOURCE', '51'],
  ])('rejects %s above its approved ceiling', (key, value) => {
    expect(() => loadConfig({ [key]: value })).toThrow(key);
  });

  it('ignores retired test spending variables in ordinary operation', () => {
    const config = loadConfig({ JEV_BUDGET_USD: '0', OPENAI_BUDGET_USD: 'invalid', TYPESAFE_AI_API_KEY: 'synthetic' });
    expect(config.credentials.jevApiKey).toBe('synthetic');
    expect(config).not.toHaveProperty('budgetUsd');
    expect(config).not.toHaveProperty('billing');
  });

  it.each(['', ' '])('rejects a blank Jev model (%j)', value => {
    expect(() => loadConfig({ JEV_MODEL: value })).toThrow('JEV_MODEL');
  });

  it('reports invalid variable names without reflecting their values', () => {
    expect(() => loadConfig({ MAX_SOURCES: 'private-value', SOURCE_CONCURRENCY: 'private-value' })).toThrow(
      /^Invalid configuration: MAX_SOURCES, SOURCE_CONCURRENCY$/,
    );
  });
});
