import { describe, expect, it, vi } from 'vitest';
import { normalizeDevServerUrl, probeMastraServer } from './local-dev';

describe('local dev connections', () => {
  it('normalizes port, host, and URL inputs', () => {
    expect(normalizeDevServerUrl('4111')).toBe('http://127.0.0.1:4111');
    expect(normalizeDevServerUrl('localhost:5123')).toBe('http://localhost:5123');
    expect(normalizeDevServerUrl(' http://127.0.0.1:4111/api/ ')).toBe('http://127.0.0.1:4111/api');
  });

  it('probes the Mastra agents endpoint', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;

    await expect(probeMastraServer('4111', fetchImpl)).resolves.toEqual({
      ok: true,
      serverUrl: 'http://127.0.0.1:4111',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:4111/api/agents',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns an actionable error when the server is unreachable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    }) as unknown as typeof fetch;

    await expect(probeMastraServer('4111', fetchImpl)).resolves.toMatchObject({
      ok: false,
      serverUrl: 'http://127.0.0.1:4111',
      error: 'connect ECONNREFUSED',
    });
  });
});
