import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '#test/msw-server';

import { createApiClient } from '../client';

const BASE_URL = 'http://localhost:4111';

describe('createApiClient', () => {
  describe('when the request succeeds', () => {
    it('prefixes the base url and returns the parsed JSON body', async () => {
      server.use(
        http.get(`${BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers: [{ provider: 'openai' }] })),
      );

      const client = createApiClient({ baseUrl: BASE_URL });
      const body = await client.get<{ providers: Array<{ provider: string }> }>('/web/config/providers');

      expect(body.providers[0].provider).toBe('openai');
    });

    it('sends the JSON body on a mutation and returns the response', async () => {
      server.use(
        http.put(`${BASE_URL}/web/config/providers/openai/key`, async ({ request }) => {
          const json = (await request.json()) as { key: string };
          return HttpResponse.json({ ok: true, key: json.key });
        }),
      );

      const client = createApiClient({ baseUrl: BASE_URL });
      const body = await client.put<{ ok: boolean; key: string }>('/web/config/providers/openai/key', {
        key: 'sk-test',
      });

      expect(body).toEqual({ ok: true, key: 'sk-test' });
    });
  });

  describe('when the server returns an error envelope', () => {
    it('throws with the server-provided error message', async () => {
      server.use(
        http.get(`${BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({ error: 'Credential storage is not available' }, { status: 503 }),
        ),
      );

      const client = createApiClient({ baseUrl: BASE_URL });

      await expect(client.get('/web/config/providers')).rejects.toThrow('Credential storage is not available');
    });
  });

  describe('when the server returns a non-JSON error', () => {
    it('throws a status-based fallback message', async () => {
      server.use(http.get(`${BASE_URL}/web/config/providers`, () => new HttpResponse('nope', { status: 500 })));

      const client = createApiClient({ baseUrl: BASE_URL });

      await expect(client.get('/web/config/providers')).rejects.toThrow('500');
    });
  });

  describe('when a custom fetch implementation is injected', () => {
    it('uses the injected fetch instead of the global one', async () => {
      let calledUrl = '';
      const fetchImpl: typeof fetch = async (input, init) => {
        calledUrl = typeof input === 'string' ? input : input.toString();
        return globalThis.fetch(input, init);
      };
      server.use(http.get(`${BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers: [] })));

      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });
      await client.get('/web/config/providers');

      expect(calledUrl).toBe(`${BASE_URL}/web/config/providers`);
    });
  });
});
