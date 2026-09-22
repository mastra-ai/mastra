import type { ListLogsResponse } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import LogsPage from '..';
import {
  emptyEntityNames,
  emptyEnvironments,
  emptyServiceNames,
  emptyTags,
} from '@/pages/traces/__tests__/fixtures/traces';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const oneLog: ListLogsResponse = {
  logs: [
    {
      logId: 'log-1',
      timestamp: '2026-06-01T10:00:00.000Z',
      level: 'info',
      message: 'a log line',
    } as ListLogsResponse['logs'][number],
  ],
  pagination: { total: 1, page: 0, perPage: 50, hasMore: false },
};

const useHandlers = (urls: string[]) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/logs`, ({ request }) => {
      urls.push(request.url);
      return HttpResponse.json(oneLog);
    }),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/tags`, () => HttpResponse.json(emptyTags)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/service-names`, () => HttpResponse.json(emptyServiceNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
  );
};

const lastOrderBy = (urls: string[]) => {
  const params = new URL(urls[urls.length - 1] ?? '').searchParams;
  return { field: params.get('field'), direction: params.get('direction') };
};

describe('when logs are sorted from the Date column', () => {
  const urls: string[] = [];

  beforeEach(() => {
    urls.length = 0;
    useHandlers(urls);
  });

  it('asks the server for newest-first by default', async () => {
    renderWithProviders(<LogsPage />, { router: true });

    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(lastOrderBy(urls)).toEqual({ field: 'timestamp', direction: 'DESC' });
    expect(screen.getByRole('button', { name: 'Date, sorted descending, sort ascending' })).toBeTruthy();
  });

  it('asks the server for oldest-first when toggled', async () => {
    renderWithProviders(<LogsPage />, { router: true });
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Date, sorted descending, sort ascending' }));

    await waitFor(() => expect(lastOrderBy(urls)).toEqual({ field: 'timestamp', direction: 'ASC' }));
    expect(screen.getByRole('button', { name: 'Date, sorted ascending, sort descending' })).toBeTruthy();
  });

  it('restores the sort from the URL', async () => {
    renderWithProviders(<LogsPage />, { router: { initialEntries: ['/logs?sort=timestamp&dir=asc'] } });

    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(lastOrderBy(urls)).toEqual({ field: 'timestamp', direction: 'ASC' });
  });
});
