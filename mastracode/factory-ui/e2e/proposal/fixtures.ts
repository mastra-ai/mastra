import type { BrowserContext } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import { HEAVY, heavySessionHandlers } from '../ui/heavy-session';
import { server } from '../ui/msw-server';

export { HEAVY, server };

export const unhandled: string[] = [];

export function listen() {
  server.listen({
    onUnhandledRequest(request) {
      unhandled.push(`${request.method} ${new URL(request.url).pathname}`);
    },
  });
}

/** Browser API calls are answered by the MSW server running in this test process. */
export function relayToFixture(context: BrowserContext, baseURL: string | undefined) {
  return context.route(
    url => url.origin === baseURL && /^\/(web|auth|api|connect)\//.test(url.pathname),
    async route => {
      const request = route.request();
      const body = request.postData() ?? undefined;
      const response = await fetch(request.url(), {
        method: request.method(),
        body: ['GET', 'HEAD'].includes(request.method()) ? undefined : body,
        headers: request.headers(),
      });
      if (response.headers.get('content-type')?.startsWith('text/event-stream')) return response.body?.cancel();
      // Unstubbed routes fall through to Vite's SPA fallback; answer them as a server without that route would.
      if (response.headers.get('content-type')?.includes('text/html')) {
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
      }
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      });
    },
  );
}

/** Ward's factory: hybrid model routing, an invited member with no personal model or provider yet. */
export const memberHandlers = [
  http.get('*/auth/me', () =>
    HttpResponse.json({
      authenticated: true,
      authEnabled: true,
      provider: 'mastra-studio',
      user: { userId: 'user-ward', email: 'ward@example.com', name: 'Ward' },
    }),
  ),
  http.get('*/web/factory/projects', () =>
    HttpResponse.json({ projects: [{ id: HEAVY.factoryId, name: 'the-factory', repositories: [] }] }),
  ),
  http.get(`*/web/factory/projects/${HEAVY.factoryId}`, () =>
    HttpResponse.json({
      project: {
        id: HEAVY.factoryId,
        name: 'the-factory',
        modelScope: 'hybrid',
        defaultModelId: 'anthropic/claude-opus-5-5',
      },
    }),
  ),
  http.get('*/web/config/default-model', () => HttpResponse.json({ modelId: null, thinkingLevel: null })),
  http.get('*/web/channel-accounts', () => HttpResponse.json({ accounts: [], canConnect: true })),
  // The first matching handler wins inside one `server.use`, so these overrides precede the shared fixture.
  ...heavySessionHandlers,
];

const oauth = { supported: true as const, modes: ['paste-code' as const] };

/** A member with nothing personal yet: the company has Anthropic; the member can sign in or paste a key. */
export function providerHandlers({ personal }: { personal?: 'anthropic' } = {}) {
  const models = [
    { id: 'anthropic/claude-opus-5-5', provider: 'anthropic', modelName: 'Claude Opus 5.5', hasApiKey: true },
    { id: 'anthropic/claude-sonnet-5-5', provider: 'anthropic', modelName: 'Claude Sonnet 5.5', hasApiKey: true },
    { id: 'anthropic/claude-haiku-5-5', provider: 'anthropic', modelName: 'Claude Haiku 5.5', hasApiKey: true },
  ];
  return [
    http.get('*/web/config/providers', () =>
      HttpResponse.json({
        orgKeyAdmin: false,
        providers: [
          {
            provider: 'anthropic',
            source: personal ? 'stored-user' : 'stored-org',
            orgKey: true,
            orgCredential: 'api_key',
            ...(personal ? { userCredential: 'oauth' } : {}),
            oauth,
          },
          { provider: 'openai', source: 'none', orgKey: false, oauth: { supported: true, modes: ['device-code'] } },
          { provider: 'google', source: 'none', orgKey: false },
          { provider: 'xai', source: 'none', orgKey: false },
          { provider: 'mastra', source: 'none', connectWithMastraAccount: true },
        ],
      }),
    ),
    http.get('*/web/config/models', ({ request }) => {
      const scope = new URL(request.url).searchParams.get('scope');
      if (scope === 'user' && !personal) return HttpResponse.json({ models: [], fallbackModelId: null });
      return HttpResponse.json({ models, fallbackModelId: personal ? 'anthropic/claude-opus-5-5' : null });
    }),
    http.get('*/web/config/default-model', () =>
      HttpResponse.json({ modelId: personal ? 'anthropic/claude-opus-5-5' : null, thinkingLevel: null }),
    ),
  ];
}
