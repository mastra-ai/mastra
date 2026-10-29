// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
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
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const setSpanDetailHandler = () =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, ({ params }) => {
      const detail = spanDetailById[String(params.spanId)];
      return detail ? HttpResponse.json(detail) : new HttpResponse(null, { status: 404 });
    }),
  );

const renderPanel = async (selection: SpanSelection) => {
  setSpanDetailHandler();
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

describe('SpanDetailPanel', () => {
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
