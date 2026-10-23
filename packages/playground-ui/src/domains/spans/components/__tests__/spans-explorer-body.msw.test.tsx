// @vitest-environment jsdom
import type { QuerySpansResult } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  emptyEntityNames,
  emptyEnvironments,
  emptySpanRows,
  firstListedSpan,
  spanQueryCapabilities,
  spanRowsPage,
} from '../../__tests__/fixtures/spans';
import type { SpanSelection } from '../span-detail-panel';
import { SpansExplorerBody } from '../spans-explorer-body';
import type { SpansExplorerPanelArgs } from '../spans-explorer-body';
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

describe('SpansExplorerBody', () => {
  useFixedChartSize(1200, 800);
  // Base UI ScrollArea calls getAnimations once a ResizeObserver exists; jsdom has no Web Animations API.
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
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
});
