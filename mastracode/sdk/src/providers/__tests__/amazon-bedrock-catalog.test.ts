import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODEL_TOKENS } from '../../../../../docs/src/plugins/remark-model-tokens/models.js';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getBedrockModelCatalog', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(async () => {
    const { clearBedrockCatalogCache } = await import('../amazon-bedrock.js');
    clearBedrockCatalogCache();
    vi.resetModules();
  });

  it('omits models whose catalog entry overrides the Converse transport', async () => {
    // The nine bedrock-mantle entries in the live models.dev catalog carry a
    // provider block pointing at a different endpoint and API shape. Every id
    // this catalog returns is served through createAmazonBedrock(), i.e.
    // Converse, so advertising them offers models the request cannot reach.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        'amazon-bedrock': {
          models: {
            [MODEL_TOKENS.__BEDROCK_MODEL_SONNET_BARE__]: {},
            'openai.gpt-5.6-sol': {
              provider: {
                npm: '@ai-sdk/amazon-bedrock/mantle',
                api: 'https://bedrock-mantle.${AWS_REGION}.api.aws/openai/v1',
                shape: 'responses',
              },
            },
            'xai.grok-4.6': { provider: { npm: '@ai-sdk/amazon-bedrock/mantle', shape: 'responses' } },
            [MODEL_TOKENS.__BEDROCK_MODEL_OPUS_BARE__]: {},
            // An empty `provider` block is not a transport override, so the
            // entry stays. Without this case the test would still pass if the
            // predicate were widened to `Boolean(provider)`, which would drop
            // every model carrying the key at all.
            [MODEL_TOKENS.__BEDROCK_MODEL_HAIKU_BARE__]: { provider: {} },
          },
        },
      }),
    );

    const { getBedrockModelCatalog } = await import('../amazon-bedrock.js');
    const models = await getBedrockModelCatalog();

    expect(models.map(m => m.id)).toEqual([
      MODEL_TOKENS.__BEDROCK_MODEL_HAIKU_BARE__,
      MODEL_TOKENS.__BEDROCK_MODEL_OPUS_BARE__,
      MODEL_TOKENS.__BEDROCK_MODEL_SONNET_BARE__,
    ]);
  });

  it.each([
    { npm: '@ai-sdk/amazon-bedrock/mantle' },
    { api: 'https://bedrock-mantle.${AWS_REGION}.api.aws/openai/v1' },
    { shape: 'responses' },
  ])('filters individual transport overrides %j but keeps Converse siblings', async provider => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        'amazon-bedrock': {
          models: {
            'openai.gpt-oss-120b': { provider },
            'openai.gpt-oss-120b-1:0': {},
            'empty.override': { provider: { npm: '', api: '', shape: '' } },
          },
        },
      }),
    );
    const { getBedrockModelCatalog } = await import('../amazon-bedrock.js');
    expect(await getBedrockModelCatalog()).toEqual([{ id: 'empty.override' }, { id: 'openai.gpt-oss-120b-1:0' }]);
  });

  it('caches a successful empty catalog without falling back when every model is overridden', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ 'amazon-bedrock': { models: { 'openai.gpt-oss-120b': { provider: { shape: 'responses' } } } } }),
    );
    const { getBedrockModelCatalog } = await import('../amazon-bedrock.js');
    expect(await getBedrockModelCatalog()).toEqual([]);
    expect(await getBedrockModelCatalog()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches models.dev and returns the amazon-bedrock model ids, sorted', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        'amazon-bedrock': {
          models: {
            [MODEL_TOKENS.__BEDROCK_MODEL_SONNET_BARE__]: {},
            [MODEL_TOKENS.__BEDROCK_MODEL_OPUS_BARE__]: {},
            [MODEL_TOKENS.__BEDROCK_MODEL_LLAMA_SCOUT_BARE__]: {},
          },
        },
        anthropic: { models: { [MODEL_TOKENS.__AI_SDK_ANTHROPIC_MODEL_SONNET__]: {} } },
      }),
    );

    const { getBedrockModelCatalog } = await import('../amazon-bedrock.js');
    const models = await getBedrockModelCatalog();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://models.dev/api.json',
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(models.map(m => m.id)).toEqual([
      MODEL_TOKENS.__BEDROCK_MODEL_OPUS_BARE__,
      MODEL_TOKENS.__BEDROCK_MODEL_SONNET_BARE__,
      MODEL_TOKENS.__BEDROCK_MODEL_LLAMA_SCOUT_BARE__,
    ]);
  });

  it('caches the result so a second call does not refetch', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ 'amazon-bedrock': { models: { 'a.model': {} } } }));

    const { getBedrockModelCatalog } = await import('../amazon-bedrock.js');
    await getBedrockModelCatalog();
    await getBedrockModelCatalog();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to a built-in list when the fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const { getBedrockModelCatalog } = await import('../amazon-bedrock.js');
    const models = await getBedrockModelCatalog();

    expect(models.length).toBeGreaterThan(0);
    expect(models.map(m => m.id)).toContain(MODEL_TOKENS.__BEDROCK_MODEL_OPUS_BARE__);
  });

  it('falls back when models.dev returns a non-OK status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503));

    const { getBedrockModelCatalog } = await import('../amazon-bedrock.js');
    const models = await getBedrockModelCatalog();

    expect(models.length).toBeGreaterThan(0);
  });
});

describe('AmazonBedrockGateway', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(async () => {
    const { clearBedrockCatalogCache } = await import('../amazon-bedrock.js');
    clearBedrockCatalogCache();
    vi.resetModules();
  });

  it('fetchProviders advertises only supported transports and preserves Converse siblings', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        'amazon-bedrock': {
          models: {
            'openai.gpt-oss-120b': { provider: { shape: 'responses' } },
            'openai.gpt-oss-120b-1:0': {},
            [MODEL_TOKENS.__BEDROCK_MODEL_HAIKU_BARE__]: { provider: {} },
          },
        },
      }),
    );
    const { createAmazonBedrockGateway } = await import('../amazon-bedrock-gateway.js');
    const providers = await createAmazonBedrockGateway().fetchProviders();
    expect(Object.keys(providers)).toEqual(['amazon-bedrock']);
    expect(providers['amazon-bedrock'].gateway).toBe('amazon-bedrock');
    expect(providers['amazon-bedrock'].models).toEqual([
      'openai.gpt-oss-120b-1:0',
      MODEL_TOKENS.__BEDROCK_MODEL_HAIKU_BARE__,
    ]);
  });

  it('fetchProviders surfaces bedrock models under an unprefixed amazon-bedrock provider key', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        'amazon-bedrock': {
          models: {
            [MODEL_TOKENS.__BEDROCK_MODEL_SONNET_BARE__]: {},
            [MODEL_TOKENS.__BEDROCK_MODEL_OPUS_BARE__]: {},
          },
        },
        anthropic: { models: { [MODEL_TOKENS.__AI_SDK_ANTHROPIC_MODEL_SONNET__]: {} } },
      }),
    );

    const { createAmazonBedrockGateway } = await import('../amazon-bedrock-gateway.js');
    const gateway = createAmazonBedrockGateway();

    expect(gateway.id).toBe('amazon-bedrock');
    expect(gateway.name).toBe('Amazon Bedrock');

    const providers = await gateway.fetchProviders();

    // Provider key must be the unprefixed `amazon-bedrock`, NOT namespaced under
    // the MastraCode gateway (`mastracode/amazon-bedrock`).
    expect(Object.keys(providers)).toEqual(['amazon-bedrock']);
    expect(providers['amazon-bedrock'].gateway).toBe('amazon-bedrock');
    expect(providers['amazon-bedrock'].models).toEqual([
      MODEL_TOKENS.__BEDROCK_MODEL_OPUS_BARE__,
      MODEL_TOKENS.__BEDROCK_MODEL_SONNET_BARE__,
    ]);
  });
});
