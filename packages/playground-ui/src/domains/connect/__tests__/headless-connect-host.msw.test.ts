import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../test/msw-server';
import { recordRequests } from '../../../test/record-requests';
import { startHeadlessAuth } from '../headless-connect';

// Uses the real @nangohq/frontend SDK: credential auth is a plain POST, so the
// host the credentials go to is observable at the network boundary.
describe('startHeadlessAuth Nango host', () => {
  it('sends credentials to a localhost Nango host over plain HTTP', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('http://localhost:3003/api-auth/api-key/some-api', async ({ request }) => {
        expect(new URL(request.url).searchParams.get('connect_session_token')).toBe('session-token');
        bodies.push(await request.json());
        return HttpResponse.json({ connectionId: 'conn_1', providerConfigKey: 'some-api' });
      }),
    );

    await startHeadlessAuth({
      sessionToken: 'session-token',
      apiBaseUrl: 'http://localhost:3003',
      integrationId: 'some-api',
      authType: 'API_KEY',
      credentials: { apiKey: 'secret' },
    }).result;

    expect(bodies).toEqual([{ apiKey: 'secret' }]);
  });

  it('refuses a remote plain-HTTP Nango host without sending anything', async () => {
    const requests = recordRequests();

    await expect(
      startHeadlessAuth({
        sessionToken: 'session-token',
        apiBaseUrl: 'http://nango.internal.example',
        integrationId: 'some-api',
        authType: 'API_KEY',
        credentials: { apiKey: 'secret' },
      }).result,
    ).rejects.toThrow('The Nango host must use HTTPS.');

    expect(requests).toEqual([]);
  });
});
