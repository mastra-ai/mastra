import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithRefresh, createFetchWithRefresh } from '../fetch-with-refresh';

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchWithRefresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('when the server returns a 2xx response', () => {
    it('passes it through unchanged with a single fetch call', async () => {
      const expected = jsonResponse({ ok: true });
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(expected);

      const res = await fetchWithRefresh('http://server', 'http://server/api/agents');

      expect(res).toBe(expected);
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    });
  });

  describe('when the server returns 401', () => {
    it('propagates the 401 without any client-side refresh dance', async () => {
      const unauthorized = jsonResponse({ error: 'Unauthorized' }, 401);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(unauthorized);

      const res = await fetchWithRefresh('http://server', 'http://server/api/agents');

      expect(res).toBe(unauthorized);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      // Server middleware already handled refresh. Client MUST NOT hit
      // /auth/refresh — that would just amplify a transient failure
      // (PLTFRM-1270).
      const urls = fetchSpy.mock.calls.map(([input]) =>
        input instanceof Request ? input.url : String(input),
      );
      expect(urls.some((u) => u.includes('/auth/refresh'))).toBe(false);
    });
  });

  describe('when the server returns 503', () => {
    it('propagates the 503 (retry is the caller\'s / React Query\'s job)', async () => {
      const transient = jsonResponse({ error: 'Auth provider unavailable' }, 503);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(transient);

      const res = await fetchWithRefresh('http://server', 'http://server/api/agents');

      expect(res).toBe(transient);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('createFetchWithRefresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('when returned as the MastraClient fetch option', () => {
    it('propagates 401 without refresh', async () => {
      const fetcher = createFetchWithRefresh('http://server', '/api');
      const unauthorized = jsonResponse({ error: 'Unauthorized' }, 401);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(unauthorized);

      const res = await fetcher('http://server/api/agents');

      expect(res).toBe(unauthorized);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('propagates 503 unchanged', async () => {
      const fetcher = createFetchWithRefresh('http://server', '/api');
      const transient = jsonResponse({}, 503);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(transient);

      const res = await fetcher('http://server/api/agents');

      expect(res).toBe(transient);
    });
  });
});
