// @vitest-environment jsdom
import type { QuerySpansResult } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyEntityNames,
  emptyEnvironments,
  emptySpanRows,
  endedSpan,
  firstListedSpan,
  spanHeadPage,
  spanQueryCapabilities,
  spanRowsPage,
} from '../../__tests__/fixtures/spans';
import type { SpanSelection } from '../span-detail-panel';
import { SpansExplorerBody } from '../spans-explorer-body';
import type { SpansExplorerPanelArgs } from '../spans-explorer-body';
import { OBSERVABILITY_LIST_POLL_INTERVAL_MS } from '@/domains/observability/list-polling';
import { useTraceColumnPreferences } from '@/domains/traces/hooks/use-trace-column-preferences';
import { DEFAULT_TRACE_COLUMN_PREFERENCES } from '@/domains/traces/trace-list-columns';
import { useFixedChartSize } from '@/test/chart-size';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const SPANS_QUERY_URL = `${TEST_BASE_URL}/api/observability/spans/query`;

const setHandlers = (spans: QuerySpansResult) =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(spanQueryCapabilities)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
    http.post(SPANS_QUERY_URL, () => HttpResponse.json(spans)),
  );

// Rendered with no router: the body only talks to its host through props.
const renderBody = (selection?: SpanSelection) => {
  const onSelectionChange = vi.fn<(selection: SpanSelection | undefined) => void>();
  const renderPanel = vi.fn<(args: SpansExplorerPanelArgs) => null>(() => null);
  renderWithProviders(
    <SpansExplorerBody selection={selection} onSelectionChange={onSelectionChange} renderPanel={renderPanel} />,
  );
  return { onSelectionChange, renderPanel };
};

/** The spans body next to a readout of the traces page's saved columns, which live under their own key. */
function BodyWithTracesColumns() {
  const traces = useTraceColumnPreferences();
  return (
    <>
      <SpansExplorerBody selection={undefined} onSelectionChange={() => {}} renderPanel={() => null} />
      <output data-testid="traces-columns">{traces.preferences.visibleColumns.join(',')}</output>
    </>
  );
}

const openColumnsMenu = async () => {
  const button = await screen.findByRole<HTMLButtonElement>('button', { name: 'Columns' });
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
};

describe('SpansExplorerBody', () => {
  useFixedChartSize(1200, 800);
  // Base UI ScrollArea calls getAnimations once a ResizeObserver exists; jsdom has no Web Animations API.
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
  });
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('when the store returns span rows', () => {
    it('lists each span', async () => {
      setHandlers(spanRowsPage);

      renderBody();

      expect(await screen.findByText('agent run: weather')).toBeTruthy();
      expect(screen.getByText('tool: get-weather')).toBeTruthy();
    });

    it('hands the listed spans to the panel, in list order', async () => {
      setHandlers(spanRowsPage);

      const { renderPanel } = renderBody();
      await screen.findByText('agent run: weather');

      expect(renderPanel).toHaveBeenLastCalledWith(
        expect.objectContaining({
          spans: [
            { traceId: 'trace-1', spanId: 'span-1' },
            { traceId: 'trace-1', spanId: 'span-2' },
          ],
        }),
      );
    });
  });

  describe('when a span ends while the page is open', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('appears in the list on the next poll', async () => {
      setHandlers(spanRowsPage);
      server.use(
        http.post(SPANS_QUERY_URL, async ({ request }) => {
          const body = (await request.json()) as { orderBy?: Array<{ field: string }> };
          return HttpResponse.json(body.orderBy?.[0]?.field === 'endedAt' ? spanHeadPage : spanRowsPage);
        }),
      );
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });

      renderBody();
      await screen.findByText('agent run: weather');
      expect(screen.queryByText(endedSpan.name)).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(OBSERVABILITY_LIST_POLL_INTERVAL_MS);
      });

      expect(await screen.findByText(endedSpan.name)).toBeTruthy();
    });
  });

  describe('when a span row is clicked', () => {
    it('asks the host to open that span', async () => {
      setHandlers(spanRowsPage);

      const { onSelectionChange } = renderBody();
      fireEvent.click(await screen.findByText('tool: get-weather'));

      expect(onSelectionChange).toHaveBeenCalledWith({ traceId: 'trace-1', spanId: 'span-2' });
    });
  });

  describe('when the open span row is clicked again', () => {
    it('asks the host to close the panel', async () => {
      setHandlers(spanRowsPage);

      const { onSelectionChange } = renderBody(firstListedSpan);
      fireEvent.click(await screen.findByText('agent run: weather'));

      expect(onSelectionChange).toHaveBeenCalledWith(undefined);
    });
  });

  describe('when the span query fails', () => {
    it('shows the error in place of the list', async () => {
      setHandlers(spanRowsPage);
      server.use(http.post(SPANS_QUERY_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderBody();

      expect(await screen.findByText('Failed to load spans')).toBeTruthy();
    });
  });

  describe('when the window has no spans', () => {
    it('shows the empty state', async () => {
      setHandlers(emptySpanRows);

      renderBody();

      expect(await screen.findByRole('heading', { name: 'No spans for the last 7 days' })).toBeTruthy();
    });
  });

  describe('when the user opens the Columns menu', () => {
    it('offers the span columns, Model and Provider included', async () => {
      setHandlers(spanRowsPage);

      renderBody();
      await openColumnsMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Model' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Provider' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Thread ID' })).toBeTruthy();
    });

    it('offers neither usage nor metadata columns', async () => {
      setHandlers(spanRowsPage);

      renderBody();
      await openColumnsMenu();
      await screen.findByRole('menuitemcheckbox', { name: 'Model' });

      expect(screen.queryByText('Usage columns')).toBeNull();
      expect(screen.queryByText('Metadata columns')).toBeNull();
    });
  });

  describe('when the user turns on the Model and Provider columns', () => {
    it("shows each span's model and provider in the list", async () => {
      setHandlers(spanRowsPage);

      renderBody();
      await openColumnsMenu();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Model' }));
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Provider' }));

      expect(await screen.findByText('gpt-5.6')).toBeTruthy();
      expect(screen.getByText('openai')).toBeTruthy();
    });

    it('keeps the choice for the next visit, without touching the traces columns', async () => {
      setHandlers(spanRowsPage);

      const { unmount } = renderWithProviders(<BodyWithTracesColumns />);
      await openColumnsMenu();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Model' }));
      await screen.findByText('gpt-5.6');
      unmount();

      renderWithProviders(<BodyWithTracesColumns />);

      expect(await screen.findByText('gpt-5.6')).toBeTruthy();
      expect(screen.getByTestId('traces-columns').textContent).toBe(
        DEFAULT_TRACE_COLUMN_PREFERENCES.visibleColumns.join(','),
      );
    });
  });
});
