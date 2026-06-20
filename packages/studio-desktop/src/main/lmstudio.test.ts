import { describe, expect, it, vi } from 'vitest';
import { probeLmStudioModels } from './lmstudio';

function mockFetch(response: Partial<Response>) {
  return vi.fn(async () => response as Response) as unknown as typeof fetch;
}

describe('probeLmStudioModels', () => {
  it('returns model ids from an OpenAI-compatible model list', async () => {
    const fetch = mockFetch({
      ok: true,
      json: async () => ({ data: [{ id: 'qwen/qwen3-30b' }, { id: 'openai/gpt-oss-20b' }] }),
    });

    await expect(probeLmStudioModels('http://localhost:1234/v1', fetch)).resolves.toEqual({
      ok: true,
      modelUrl: 'http://localhost:1234/v1',
      models: ['qwen/qwen3-30b', 'openai/gpt-oss-20b'],
      error: undefined,
    });
    expect(fetch).toHaveBeenCalledWith('http://localhost:1234/v1/models', expect.any(Object));
  });

  it('reports HTTP errors', async () => {
    const fetch = mockFetch({ ok: false, status: 503 });
    await expect(probeLmStudioModels('http://localhost:1234/v1', fetch)).resolves.toMatchObject({
      ok: false,
      models: [],
      error: 'LM Studio returned HTTP 503',
    });
  });

  it('reports empty model lists without failing the probe', async () => {
    const fetch = mockFetch({ ok: true, json: async () => ({ data: [] }) });
    await expect(probeLmStudioModels('http://localhost:1234/v1', fetch)).resolves.toMatchObject({
      ok: true,
      models: [],
      error: 'LM Studio did not report any loaded models',
    });
  });

  it('reports malformed responses', async () => {
    const fetch = mockFetch({ ok: true, json: async () => ({ models: [] }) });
    await expect(probeLmStudioModels('http://localhost:1234/v1', fetch)).resolves.toMatchObject({
      ok: false,
      models: [],
      error: 'LM Studio returned an invalid model list',
    });
  });

  it('reports connection failures', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    }) as unknown as typeof globalThis.fetch;

    await expect(probeLmStudioModels('http://localhost:1234/v1', fetch)).resolves.toMatchObject({
      ok: false,
      models: [],
      error: 'connect ECONNREFUSED',
    });
  });
});
