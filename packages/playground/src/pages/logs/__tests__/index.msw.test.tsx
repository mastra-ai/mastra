import type { ListLogsResponse } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LogsPage from '..';
import {
  emptyEntityNames,
  emptyFeedback,
  emptyTraceSpanScores,
  traceSpans,
  emptyEnvironments,
  emptyServiceNames,
  emptyTags,
} from '@/pages/traces/__tests__/fixtures/traces';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// The logs list dispatches a synthetic scroll event once logs load, which
// starts the virtualizer's 150ms "is scrolling" debounce. Let it fire while
// jsdom is still alive so it doesn't throw "window is not defined" after
// teardown.
afterAll(() => new Promise(resolve => setTimeout(resolve, 200)));

const oneLog: ListLogsResponse = {
  logs: [
    {
      logId: 'log-1',
      timestamp: '2026-06-01T10:00:00.000Z',
      level: 'info',
      message: 'a log line',
      traceId: 'trace-a',
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

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
};

const renderPage = (initialEntry = '/logs') =>
  renderWithProviders(
    <>
      <LogsPage />
      <LocationProbe />
    </>,
    { router: { initialEntries: [initialEntry] } },
  );

const useDrawerHandlers = () => {
  useHandlers([]);
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () =>
      HttpResponse.json(emptyTraceSpanScores),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(traceSpans)),
  );
};

describe('LogsPage log drawer', () => {
  beforeEach(() => {
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
    useDrawerHandlers();
    // jsdom has no layout; give the list viewport a size so the virtualizer renders rows.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when a log row is clicked', () => {
    it('opens the log drawer and keeps the list rendered', async () => {
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: /a log line/ }));

      expect(await screen.findByRole('dialog', { name: /^Log / })).toBeTruthy();
      expect(screen.getByRole('button', { name: /a log line/, hidden: true })).toBeTruthy();
    });
  });

  describe('when the URL has logId', () => {
    it('opens the log drawer on load', async () => {
      renderPage('/logs?logId=log-1');

      expect(await screen.findByRole('dialog', { name: /^Log / })).toBeTruthy();
    });
  });

  describe('when the Trace button is clicked in the log drawer', () => {
    it('opens the trace drawer on top', async () => {
      renderPage('/logs?logId=log-1');
      const logDialog = await screen.findByRole('dialog', { name: /^Log / });

      fireEvent.click(within(logDialog).getByRole('button', { name: /^Trace/ }));

      expect(await screen.findByRole('dialog', { name: /trace-a/ })).toBeTruthy();
      expect(screen.getByTestId('location').textContent).toContain('traceId=trace-a');
    });
  });

  describe('when the log drawer is closed', () => {
    it('removes the drawer and clears logId from the URL', async () => {
      renderPage('/logs?logId=log-1');
      const logDialog = await screen.findByRole('dialog', { name: /^Log / });

      fireEvent.click(within(logDialog).getByRole('button', { name: /close/i }));

      await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Log / })).toBeNull());
      expect(screen.getByTestId('location').textContent).not.toContain('logId');
    });
  });
});
