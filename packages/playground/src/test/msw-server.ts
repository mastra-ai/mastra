import { http, HttpResponse } from 'msw';
import type { HttpHandler } from 'msw';
import { setupServer } from 'msw/node';

export const defaultHandlers: HttpHandler[] = [
  http.get('*/api/stored/skills', () =>
    HttpResponse.json({ skills: [], total: 0, page: 1, perPage: 50, hasMore: false }),
  ),
  // Tool cards resolve a tool's intrinsic `id` from the tools list (to detect
  // built-ins like `ask_user` regardless of registration key). Default to an
  // empty map; tests that care about id resolution override this per-test.
  http.get('*/api/tools', () => HttpResponse.json({})),
];

export const server = setupServer(...defaultHandlers);
