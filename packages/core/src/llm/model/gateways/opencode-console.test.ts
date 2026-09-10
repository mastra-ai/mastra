import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelsDevGateway } from './models-dev.js';
import {
  OPENCODE_CONSOLE_ANTHROPIC_URL,
  OPENCODE_CONSOLE_CATALOG_TIMEOUT_MS,
  OPENCODE_CONSOLE_MODELS_URL,
  fetchOpenCodeConsoleModelIds,
  OPENCODE_CONSOLE_FALLBACK_MODELS,
  OPENCODE_CONSOLE_GOOGLE_URL,
  buildOpenCodeConsoleProvider,
  getOpenCodeConsoleModelOverride,
} from './opencode-console.js';

describe('OpenCode Console provider helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['headers', 'body'])('bounds provider discovery when Console %s never resolve', async phase => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        if (url !== OPENCODE_CONSOLE_MODELS_URL) {
          return Response.json({
            openai: {
              id: 'openai',
              name: 'OpenAI',
              api: 'https://api.openai.com/v1',
              npm: '@ai-sdk/openai',
              env: ['OPENAI_API_KEY'],
              models: { 'gpt-test': {} },
            },
          });
        }
        signal = init.signal;
        if (phase === 'headers') return new Promise(() => {});
        return { ok: true, json: () => new Promise(() => {}) };
      }),
    );
    const result = new ModelsDevGateway().fetchProviders();
    await vi.advanceTimersByTimeAsync(OPENCODE_CONSOLE_CATALOG_TIMEOUT_MS);
    const providers = await result;
    expect(providers.openai.models).toEqual(['gpt-test']);
    expect(providers['opencode-console'].models).toEqual([...OPENCODE_CONSOLE_FALLBACK_MODELS].sort());
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('swallows the aborted catalog request after the discovery deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }),
      ),
    );
    const result = fetchOpenCodeConsoleModelIds();
    await vi.advanceTimersByTimeAsync(OPENCODE_CONSOLE_CATALOG_TIMEOUT_MS);
    await expect(result).resolves.toEqual([...OPENCODE_CONSOLE_FALLBACK_MODELS].sort());
    await Promise.resolve();
  });

  it('filters invalid catalog IDs, deduplicates and clears the deadline on success', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          data: [{ id: 'glm-5.3-flash' }, { id: 'glm-5.3-flash' }, { id: ' ' }, { id: 'test' }, { id: 1 }],
        }),
      ),
    );
    expect(await fetchOpenCodeConsoleModelIds()).toEqual(['glm-5.3-flash']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['glm-5.3-flash', '/openai/v1/chat/completions'],
    ['gpt-5.6-luna', '/openai/v1/responses'],
    ['grok-4.6', '/openai/v1/responses'],
    ['muse-spark-1.3', '/openai/v1/responses'],
    ['claude-sonnet-5', '/anthropic/v1/messages'],
    ['qwen3.6-plus', '/anthropic/v1/messages'],
    ['gemini-3.8-flash', '/google/v1beta/models/gemini-3.8-flash:generateContent'],
  ])('serializes %s with Bearer authentication and caller headers', async (modelId, path) => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('{}', { status: 400, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetch);
    const { config } = buildOpenCodeConsoleProvider({ modelIds: [modelId] });
    const gateway = new ModelsDevGateway({ 'opencode-console': config });
    const model = await gateway.resolveLanguageModel({
      providerId: 'opencode-console',
      modelId,
      apiKey: 'local-dummy',
      headers: { 'x-opencode-org-id': 'local-org', 'X-Custom-Header': 'preserved' },
    });
    await expect(
      model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'local' }] }] }),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe(`https://opencode.ai/inference${path}`);
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer local-dummy');
    expect(headers.has('x-api-key')).toBe(false);
    expect(headers.has('x-goog-api-key')).toBe(false);
    expect(headers.get('x-opencode-org-id')).toBe('local-org');
    expect(headers.get('x-custom-header')).toBe('preserved');
  });

  it.each(['qwen3.6-plus', 'gemini-3.8-flash'])('preserves caller Bearer authorization for %s', async modelId => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({}, { status: 400 }));
    vi.stubGlobal('fetch', fetch);
    const { config } = buildOpenCodeConsoleProvider({ modelIds: [modelId] });
    const model = await new ModelsDevGateway({ 'opencode-console': config }).resolveLanguageModel({
      providerId: 'opencode-console',
      modelId,
      apiKey: 'local-dummy',
      headers: { authorization: 'Bearer caller-dummy' },
    });
    await expect(
      model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'local' }] }] }),
    ).rejects.toThrow();
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer caller-dummy');
  });

  it.each([
    ['glm-5.3-flash', 'video/mp4'],
    ['qwen3.6-plus', 'video/mp4'],
    ['muse-spark-1.3', 'audio/wav'],
    ['muse-spark-1.3', 'video/mp4'],
  ])('rejects unsupported default-route media for %s (%s) before inference', async (modelId, mediaType) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { config } = buildOpenCodeConsoleProvider({ modelIds: [modelId] });
    const model = await new ModelsDevGateway({ 'opencode-console': config }).resolveLanguageModel({
      providerId: 'opencode-console',
      modelId,
      apiKey: 'local-dummy',
    });
    await expect(
      model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'file', mediaType, data: new Uint8Array([0, 1, 2]) }] }],
      }),
    ).rejects.toThrow(/not supported/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves the configured Console model-family mappings without claiming remote compatibility', () => {
    expect(getOpenCodeConsoleModelOverride('gpt-5.6-luna')).toEqual({
      shape: 'responses',
      npm: '@ai-sdk/openai',
    });
    expect(getOpenCodeConsoleModelOverride('claude-sonnet-5')).toEqual({
      api: OPENCODE_CONSOLE_ANTHROPIC_URL,
      npm: '@ai-sdk/anthropic',
    });
    expect(getOpenCodeConsoleModelOverride('qwen3.6-plus')).toEqual({
      api: OPENCODE_CONSOLE_ANTHROPIC_URL,
      npm: '@ai-sdk/anthropic',
    });
    expect(getOpenCodeConsoleModelOverride('gemini-3.8-flash')).toEqual({
      api: OPENCODE_CONSOLE_GOOGLE_URL,
      npm: '@ai-sdk/google',
    });
    expect(getOpenCodeConsoleModelOverride('muse-spark-1.3')).toEqual({
      shape: 'responses',
      npm: '@ai-sdk/openai',
    });
    expect(getOpenCodeConsoleModelOverride('grok-4.6')).toEqual({
      shape: 'responses',
      npm: '@ai-sdk/openai',
    });
    expect(getOpenCodeConsoleModelOverride('grok-build-0.1')).toBeUndefined();
    expect(getOpenCodeConsoleModelOverride('glm-5.3-flash')).toBeUndefined();
  });

  it('includes glm-5.3-flash in the fallback catalog from the feature request', () => {
    expect(OPENCODE_CONSOLE_FALLBACK_MODELS).toContain('glm-5.3-flash');
  });

  it('copies overlapping OpenCode Zen capabilities onto Console models', () => {
    const provider = buildOpenCodeConsoleProvider({
      modelIds: ['glm-5.3-flash', 'test', 'gpt-5.6-luna'],
      attachmentModels: ['glm-5.3-flash', 'unused-zen-model'],
      temperatureModels: ['glm-5.3-flash'],
      structuredOutputModels: ['glm-5.3-flash'],
    });

    expect(provider.config.models).toEqual(['glm-5.3-flash', 'gpt-5.6-luna'].sort());
    expect(provider.config.models).not.toContain('test');
    expect(provider.attachment).toEqual(['glm-5.3-flash']);
    expect(provider.temperature).toEqual(['glm-5.3-flash']);
    expect(provider.structuredOutput).toEqual(['glm-5.3-flash']);
  });

  it('deduplicates overlapping Zen and Go capability lists', () => {
    const provider = buildOpenCodeConsoleProvider({
      modelIds: ['glm-5.3-flash'],
      attachmentModels: ['glm-5.3-flash', 'glm-5.3-flash'],
      temperatureModels: ['glm-5.3-flash', 'glm-5.3-flash'],
      structuredOutputModels: ['glm-5.3-flash', 'glm-5.3-flash'],
    });

    expect(provider.attachment).toEqual(['glm-5.3-flash']);
    expect(provider.temperature).toEqual(['glm-5.3-flash']);
    expect(provider.structuredOutput).toEqual(['glm-5.3-flash']);
  });
});
