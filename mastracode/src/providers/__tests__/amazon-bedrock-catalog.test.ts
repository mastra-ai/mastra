import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
            'us.anthropic.claude-sonnet-4-5-20250929-v1:0': {},
            'us.anthropic.claude-opus-4-6-v1': {},
            'us.meta.llama4-scout-17b-instruct-v1:0': {},
          },
        },
        anthropic: { models: { 'claude-sonnet-4-5': {} } },
      }),
    );

    const { getBedrockModelCatalog } = await import('../amazon-bedrock.js');
    const models = await getBedrockModelCatalog();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://models.dev/api.json',
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(models.map(m => m.id)).toEqual([
      'us.anthropic.claude-opus-4-6-v1',
      'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      'us.meta.llama4-scout-17b-instruct-v1:0',
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
    expect(models.map(m => m.id)).toContain('us.anthropic.claude-opus-4-6-v1');
  });

  it('falls back when models.dev returns a non-OK status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503));

    const { getBedrockModelCatalog } = await import('../amazon-bedrock.js');
    const models = await getBedrockModelCatalog();

    expect(models.length).toBeGreaterThan(0);
  });
});
