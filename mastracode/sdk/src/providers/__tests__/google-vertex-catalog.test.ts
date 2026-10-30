import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getGoogleVertexModelCatalog', () => {
  beforeEach(() => fetchMock.mockReset());

  afterEach(async () => {
    const { clearGoogleVertexCatalogCache } = await import('../google-vertex.js');
    clearGoogleVertexCatalogCache();
    vi.resetModules();
  });

  it('fetches sorted google-vertex model ids from models.dev and caches them', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        'google-vertex': {
          models: {
            'gemini-3.8-pro': {},
            'gemini-3.8-flash': {},
          },
        },
      }),
    );

    const { getGoogleVertexModelCatalog } = await import('../google-vertex.js');
    await expect(getGoogleVertexModelCatalog()).resolves.toEqual([
      { id: 'gemini-3.8-flash' },
      { id: 'gemini-3.8-pro' },
    ]);
    await getGoogleVertexModelCatalog();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses a stable fallback when models.dev is unavailable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const { getGoogleVertexModelCatalog } = await import('../google-vertex.js');
    await expect(getGoogleVertexModelCatalog()).resolves.toContainEqual({ id: 'gemini-3.8-flash' });
  });
});

describe('GoogleVertexGateway', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.GOOGLE_VERTEX_PROJECT = 'test-project';
    process.env.GOOGLE_VERTEX_LOCATION = 'us-central1';
  });

  afterEach(async () => {
    const { clearGoogleVertexCatalogCache } = await import('../google-vertex.js');
    clearGoogleVertexCatalogCache();
    vi.resetModules();
  });

  it('advertises Vertex models as authenticated when ADC configuration is present', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ 'google-vertex': { models: { 'gemini-3.8-flash': {} } } }));

    const { createGoogleVertexGateway } = await import('../google-vertex-gateway.js');
    const gateway = createGoogleVertexGateway();

    expect(gateway.shouldEnable()).toBe(true);
    expect(
      gateway.resolveAuth({
        gatewayId: 'google-vertex',
        providerId: 'google-vertex',
        modelId: 'gemini-3.8-flash',
        routerId: 'google-vertex/gemini-3.8-flash',
      }),
    ).toMatchObject({ source: 'gateway' });
    await expect(gateway.fetchProviders()).resolves.toMatchObject({
      'google-vertex': {
        gateway: 'google-vertex',
        models: ['gemini-3.8-flash'],
      },
    });
  });
});
