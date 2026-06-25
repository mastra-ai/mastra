import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODEL_TOKENS } from '../../../../docs/src/plugins/remark-model-tokens/models';

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
