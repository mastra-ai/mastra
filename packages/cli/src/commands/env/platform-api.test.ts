import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.MASTRA_PLATFORM_API_URL = 'http://localhost:9999';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MASTRA_PLATFORM_API_URL;
});

describe('enableBackgroundWorkers', () => {
  it('enables workers with the selected Redis source', async () => {
    const environment = { id: 'env-1', backgroundWorkersConfig: { enabled: true } };
    fetchMock.mockResolvedValue(jsonResponse(200, { environment, transition: 'provisioned' }));

    const { enableBackgroundWorkers } = await import('./platform-api.js');
    await expect(enableBackgroundWorkers('tok', 'org-1', 'proj-1', 'env-1', 'byo')).resolves.toEqual(environment);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:9999/v1/projects/proj-1/environments/env-1/background-workers');
    expect(init).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer tok', 'x-organization-id': 'org-1' }),
      }),
    );
    expect(JSON.parse(init.body)).toEqual({ config: { enabled: true }, redisSource: 'byo' });
  });

  it('surfaces the platform error detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse(402, { detail: 'Scalable Server add-on required' }));

    const { enableBackgroundWorkers } = await import('./platform-api.js');
    await expect(enableBackgroundWorkers('tok', 'org-1', 'proj-1', 'env-1', 'managed')).rejects.toThrow(
      'Scalable Server add-on required',
    );
  });
});
