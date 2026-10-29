import type { GetSystemPackagesResponse } from '@mastra/client-js';
import { http, HttpResponse } from 'msw';
import type { HttpHandler } from 'msw';
import { setupServer } from 'msw/node';

export const defaultSystemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
  liveKitConnectionRouteEnabled: true,
};

export const defaultHandlers: HttpHandler[] = [
  http.get('*/api/stored/skills', () =>
    HttpResponse.json({ skills: [], total: 0, page: 1, perPage: 50, hasMore: false }),
  ),
  http.get('*/api/system/packages', () => HttpResponse.json(defaultSystemPackages)),
  // The sidebar probes the end-user connect surface; the dev-server default is
  // "routes not mounted" (404). Suites exercising the surface override this.
  http.get('*/connect/providers', () =>
    HttpResponse.json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404 }),
  ),
];

export const server = setupServer(...defaultHandlers);
