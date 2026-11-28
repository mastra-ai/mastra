import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Agent } from '../../../agent';
import { webSearchTool } from '../../../tools/builtin/web-search';
import { defaultGateways } from './defaults';
import { GatewayManager } from './gateway-manager';

/**
 * A fresh project switched to Mastra Gateway (`mastra/<provider>/<model>`) but run without
 * MASTRA_GATEWAY_API_KEY. The Mastra gateway turns itself off without a key, so its ids fell through
 * to models.dev and every message failed without naming the key: "Could not find config for provider
 * mastra", or, with webSearchTool, "Could not infer a supported provider from "mastra"".
 */
const ENV_KEYS = ['MASTRA_GATEWAY_API_KEY', 'NETLIFY_TOKEN', 'NETLIFY_SITE_ID', 'OPENAI_API_KEY'];

describe('model ids whose gateway has no key', () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
    for (const key of ENV_KEYS) delete process.env[key];
  });
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const generateError = (model: string, tools: Record<string, unknown> = {}) =>
    new Agent({
      id: 'research-agent',
      name: 'Research Agent',
      instructions: 'Use web search when you need current information.',
      model,
      tools: tools as any,
    })
      .generate('What happened in the news today?')
      .then(
        () => {
          throw new Error('expected generate to fail');
        },
        (e: { id?: string; message: string }) => ({ id: e.id, message: e.message }),
      );

  const missingGatewayKey = {
    id: 'MASTRA_GATEWAY_NO_API_KEY',
    message: 'Missing MASTRA_GATEWAY_API_KEY environment variable',
  };

  it.each(['mastra/openai/gpt-5-mini', 'mastra/anthropic/claude-sonnet-4-5'])(
    '%s reports the Mastra gateway missing-key error',
    async model => {
      expect(await generateError(model)).toEqual(missingGatewayKey);
    },
  );

  it.each(['mastra/openai/gpt-5-mini', 'mastra/anthropic/claude-sonnet-4-5'])(
    '%s with webSearchTool reports the same missing-key error',
    async model => {
      expect(await generateError(model, { webSearch: webSearchTool })).toEqual(missingGatewayKey);
    },
  );

  it('streaming a mastra/ model reports the missing-key error', async () => {
    const output = await new Agent({ id: 'a', name: 'a', instructions: 'x', model: 'mastra/openai/gpt-5-mini' })
      .stream('Hi')
      .then(stream => stream.getFullOutput())
      .catch((e: unknown) => ({ error: e }));
    expect(String(((output as { error?: Error }).error as Error)?.message)).toBe(missingGatewayKey.message);
  });

  it('keeps the errors other model ids already give', async () => {
    expect(await generateError('netlify/openai/gpt-5-mini')).toEqual({
      id: 'NETLIFY_GATEWAY_NO_TOKEN',
      message: 'Missing NETLIFY_TOKEN environment variable required for model: netlify/openai/gpt-5-mini',
    });
    expect(await generateError('openai/gpt-5-mini')).toEqual({
      id: undefined,
      message: 'Could not find API key process.env.OPENAI_API_KEY for model id openai/gpt-5-mini',
    });
    expect(await generateError('unknown-provider/some-model')).toEqual({
      id: undefined,
      message: 'Could not find config for provider unknown-provider with model id unknown-provider/some-model',
    });
  });

  it('still reports no auth for a mastra/ model in model pickers', async () => {
    expect(await new GatewayManager(defaultGateways).hasAuth('mastra/openai/gpt-5-mini')).toBe(false);
  });
});
