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

import { rmSync } from 'node:fs';
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
