import { http, HttpResponse } from 'msw';
import type { HttpHandler } from 'msw';
import { setupServer } from 'msw/node';

export const defaultHandlers: HttpHandler[] = [
  http.get('*/api/stored/skills', () =>
    HttpResponse.json({ skills: [], total: 0, page: 1, perPage: 50, hasMore: false }),
  ),
];

export const server = setupServer(...defaultHandlers);
