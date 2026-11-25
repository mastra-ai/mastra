// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  firstListedSpan,
  lastListedSpan,
  listedSpans,
  middleListedSpan,
  spanDetailById,
} from '../../__tests__/fixtures/spans';
import { SpanDetailPanel } from '../span-detail-panel';
import type { SpanSelection } from '../span-detail-panel';
import { server } from '@/test/msw-server';
import { recordRequests } from '@/test/record-requests';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const setSpanDetailHandler = () =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, ({ params }) => {
      const detail = spanDetailById[String(params.spanId)];
      return detail ? HttpResponse.json(detail) : new HttpResponse(null, { status: 404 });
    }),
  );

const renderPanel = async (selection: SpanSelection, { keepHandlers = false }: { keepHandlers?: boolean } = {}) => {
  if (!keepHandlers) setSpanDetailHandler();
  const onSelect = vi.fn<(selection: SpanSelection) => void>();
  const onShowTrace = vi.fn<(selection: SpanSelection) => void>();
  const { queryClient } = renderWithProviders(
    <SpanDetailPanel selection={selection} spans={listedSpans} onSelect={onSelect} onShowTrace={onShowTrace} />,
  );
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  return { onSelect, onShowTrace };
};

const navButton = (name: 'Go to previous span' | 'Go to next span') =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

// jsdom does not provide PointerEvent, which Base UI tabs dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());

describe('SpanDetailPanel', () => {
  // A tab loads what it draws when it opens, as the spans page did before the panel took its data from above.
  describe('when it loads what a tab needs', () => {
    const traceOf = firstListedSpan.traceId;
    const renderWithTabData = async (spanFields: Record<string, unknown> = {}) => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, ({ params }) => {
          const detail = spanDetailById[String(params.spanId)];
          return detail
            ? HttpResponse.json({ span: { ...detail.span, ...spanFields } })
            : new HttpResponse(null, { status: 404 });
        }),
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () =>
          HttpResponse.json({ traceId: traceOf, spans: [] }),
        ),
        http.get(`${TEST_BASE_URL}/api/tools`, () => HttpResponse.json({})),
        http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
      );
      const requests = recordRequests();
      await renderPanel(firstListedSpan, { keepHandlers: true });
      return requests;
    };

    it('loads the span’s trace only once its Output tab opens', async () => {
      const requests = await renderWithTabData();
      expect(requests).not.toContain(`/api/observability/traces/${traceOf}`);

      fireEvent.click(screen.getByRole('tab', { name: /^Output/ }));

      await waitFor(() => expect(requests).toContain(`/api/observability/traces/${traceOf}`));
    });

    it('loads the tool registry once the Input tab of a span that offered tools opens', async () => {
      const requests = await renderWithTabData({
        attributes: { tools: [{ type: 'function', name: 'weatherInfo', description: 'Weather of a city.' }] },
      });
      expect(requests).not.toContain('/api/tools');

      fireEvent.click(screen.getByRole('tab', { name: /^Input/ }));

      await waitFor(() => expect(requests).toContain('/api/tools'));
    });

    it('loads no tool registry for a span that offered no tools, even on its Input tab', async () => {
      const requests = await renderWithTabData();

      fireEvent.click(screen.getByRole('tab', { name: /^Input/ }));
      await screen.findByRole('tabpanel', { name: 'Input' });

      expect(requests).not.toContain('/api/tools');
    });

    it('loads no MCP app tools for a span that called no tool', async () => {
      const requests = await renderWithTabData();

      fireEvent.click(screen.getByRole('tab', { name: /^Output/ }));
      await waitFor(() => expect(requests).toContain(`/api/observability/traces/${traceOf}`));

      expect(requests).not.toContain('/api/mcp/v0/servers');
    });

    it('loads the MCP app tools once the Output tab of a span that called a tool opens', async () => {
      const requests = await renderWithTabData({
        spanType: SpanType.MODEL_GENERATION,
        output: {
          text: 'Checking the weather.',
          toolCalls: [{ toolCallId: 'call-weather', toolName: 'weatherInfo', args: { city: 'Paris' } }],
        },
      });
      expect(requests).not.toContain('/api/mcp/v0/servers');

      fireEvent.click(screen.getByRole('tab', { name: /^Output/ }));

      await waitFor(() => expect(requests).toContain('/api/mcp/v0/servers'));
    });
  });

  describe('when the first listed span is selected', () => {
    it('loads the selected span', async () => {
      await renderPanel(firstListedSpan);

      expect(await screen.findByText('session-weather-42')).toBeTruthy();
    });

    it('disables the previous button', async () => {
      await renderPanel(firstListedSpan);

      expect(navButton('Go to previous span').disabled).toBe(true);
    });

    it('selects the second span on next', async () => {
      const { onSelect } = await renderPanel(firstListedSpan);

      fireEvent.click(navButton('Go to next span'));

      expect(onSelect).toHaveBeenCalledWith(middleListedSpan);
    });
  });

  describe('when the last listed span is selected', () => {
    it('disables the next button', async () => {
      await renderPanel(lastListedSpan);

      expect(navButton('Go to next span').disabled).toBe(true);
    });

    it('selects the previous span on previous', async () => {
      const { onSelect } = await renderPanel(lastListedSpan);

      fireEvent.click(navButton('Go to previous span'));

      expect(onSelect).toHaveBeenCalledWith(middleListedSpan);
    });
  });

  describe('when the host handles "Go to trace"', () => {
    it('hands it the selected span', async () => {
      const { onShowTrace } = await renderPanel(middleListedSpan);

      fireEvent.click(screen.getByRole('button', { name: 'Go to trace' }));

      expect(onShowTrace).toHaveBeenCalledWith(middleListedSpan);
    });
  });
});
