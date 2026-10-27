// @vitest-environment jsdom
import type { QueryTraceThreadsResult } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  discoveredEntityNames,
  discoveredEnvironments,
  emptyThreadRows,
  threadHeadPage,
  threadQueryCapabilities,
  threadRowsPage,
} from '../../__tests__/fixtures/threads';
import { ThreadsExplorerBody } from '../threads-explorer-body';
import { OBSERVABILITY_LIST_POLL_INTERVAL_MS } from '@/domains/observability/list-polling';
import { useFixedChartSize } from '@/test/chart-size';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const THREADS_QUERY_URL = `${TEST_BASE_URL}/api/observability/threads/query`;

const setHandlers = (threads: QueryTraceThreadsResult) =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(threadQueryCapabilities)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () =>
      HttpResponse.json(discoveredEntityNames),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () =>
      HttpResponse.json(discoveredEnvironments),
    ),
    http.post(THREADS_QUERY_URL, () => HttpResponse.json(threads)),
  );

// Rendered with no router: the body only talks to its host through props.
const renderBody = () => {
  const onSelectedThreadChange = vi.fn<(threadId: string | undefined) => void>();
  renderWithProviders(
    <ThreadsExplorerBody
      selectedThreadId={undefined}
      onSelectedThreadChange={onSelectedThreadChange}
      onOpenScore={() => {}}
    />,
  );
  return { onSelectedThreadChange };
};

describe('ThreadsExplorerBody', () => {
  useFixedChartSize(1200, 800);
  // Base UI ScrollArea calls getAnimations once a ResizeObserver exists; jsdom has no Web Animations API.
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
  });

  describe('when the store returns thread rows', () => {
    it('lists each thread by its agent', async () => {
      setHandlers(threadRowsPage);

      renderBody();

      expect(await screen.findByText('Weather Agent')).toBeTruthy();
      expect(screen.getByText('Support Agent')).toBeTruthy();
    });
  });

  describe('when a thread row is clicked', () => {
    it('asks the host to open that thread', async () => {
      setHandlers(threadRowsPage);

      const { onSelectedThreadChange } = renderBody();
      fireEvent.click(await screen.findByText('Support Agent'));

      expect(onSelectedThreadChange).toHaveBeenCalledWith('thread-2');
    });
  });

  describe('when the thread query fails', () => {
    it('shows the error in place of the list', async () => {
      setHandlers(threadRowsPage);
      server.use(http.post(THREADS_QUERY_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderBody();

      expect(await screen.findByText('Failed to load threads')).toBeTruthy();
    });
  });

  describe('when the window has no threads', () => {
    it('shows the empty state', async () => {
      setHandlers(emptyThreadRows);

      renderBody();

      expect(await screen.findByRole('heading', { name: 'No threads for the last 7 days' })).toBeTruthy();
    });
  });

  describe('when a thread starts while the page is open', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('appears in the list on the next poll', async () => {
      setHandlers(threadRowsPage);
      server.use(
        http.post(THREADS_QUERY_URL, async ({ request }) => {
          const body = (await request.json()) as { orderBy?: Array<{ field: string }> };
          return HttpResponse.json(body.orderBy?.[0]?.field === 'endedAt' ? threadHeadPage : threadRowsPage);
        }),
      );
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });

      renderBody();
      expect(await screen.findAllByText('Weather Agent')).toHaveLength(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(OBSERVABILITY_LIST_POLL_INTERVAL_MS);
      });

      await waitFor(() => expect(screen.getAllByText('Weather Agent')).toHaveLength(2));
    });
  });
});
