// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeDetailPanel } from '../theme-detail-panel';
import {
  fadingThemeHistoryResponse,
  firstThemeExamplesResponse,
  risingTrendFallingCountsHistoryResponse,
  secondThemeExamplesResponse,
  singlePointThemeHistoryResponse,
  themeDetailResponse,
  themeHistoryResponse,
  truncatedThemeHistoryResponse,
  zeroCoverageThemeDetailResponse,
} from './fixtures/theme-drilldown';
import { server } from '@/test/msw-server';

const BASE_URL = window.location.origin;
const detailPath = `${BASE_URL}/api/learning/entities/support-agent/themes/101`;

function usePanelHandlers({
  detail = themeDetailResponse,
  history = themeHistoryResponse,
}: {
  detail?: typeof themeDetailResponse;
  history?: typeof themeHistoryResponse;
} = {}) {
  server.use(
    http.get(detailPath, () => HttpResponse.json(detail)),
    http.get(`${detailPath}/examples`, ({ request }) => {
      const offset = new URL(request.url).searchParams.get('offset');
      return HttpResponse.json(offset === '5' ? secondThemeExamplesResponse : firstThemeExamplesResponse);
    }),
    http.get(`${detailPath}/history`, () => HttpResponse.json(history)),
  );
}

function renderPanel({ snapshotTotal = 4 }: { snapshotTotal?: number } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const selection = { signalName: 'goal', themeId: '101', label: 'Add transcript' } as const;
  const panel = (snapshotId: string) => (
    <QueryClientProvider client={queryClient}>
      <ThemeDetailPanel
        entityId="support-agent"
        entityType="agent"
        snapshotId={snapshotId}
        snapshotTotal={snapshotTotal}
        selection={selection}
        onClose={vi.fn()}
      />
    </QueryClientProvider>
  );
  const result = render(panel('opaque-snapshot-cursor'));

  return {
    ...result,
    rerenderSnapshot: (snapshotId: string) => result.rerender(panel(snapshotId)),
  };
}

afterEach(() => {
  cleanup();
});

describe('ThemeDetailPanel', () => {
  describe('when a goal theme is open in a multi-snapshot range', () => {
    it('summarizes the theme share as a sentence instead of a stage-share stat', async () => {
      usePanelHandlers();
      renderPanel();

      expect(await screen.findByText('6 of 9 traces in this snapshot (67%)')).not.toBeNull();
      expect(screen.queryByText('Stage share')).toBeNull();
    });

    it('labels the header with the goal signal and its description', async () => {
      usePanelHandlers();
      renderPanel();
      await screen.findByRole('dialog', { name: 'Add transcript' });

      expect(screen.queryByText(/^theme$/i)).toBeNull();
      fireEvent.focus(screen.getByRole('button', { name: 'Goal' }));

      expect((await screen.findByRole('tooltip')).textContent).toContain('What the user wanted');
    });

    it('paginates examples with page numbers in both directions', async () => {
      usePanelHandlers();
      renderPanel();
      await screen.findByText('Add this transcript to my workspace.');
      expect(screen.getByText('Page 1 of 2')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(await screen.findByText('Save the transcript with the project.')).not.toBeNull();
      expect(screen.getByText('Page 2 of 2')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

      expect(await screen.findByText('Add this transcript to my workspace.')).not.toBeNull();
      expect(screen.getByText('Page 1 of 2')).not.toBeNull();
    });

    it('summarizes the trend and plots the lifecycle without clustering states', async () => {
      usePanelHandlers();
      renderPanel();

      expect(await screen.findByRole('heading', { name: 'Trend' })).not.toBeNull();
      expect(screen.getByText('First seen Jul 8, 2026 · in 2 snapshots · growing')).not.toBeNull();
      expect(screen.getByTestId('trend-chart')).not.toBeNull();
      const olderMarker = screen.getByLabelText('Jul 8, 2026 · 1 trace (50%)');
      const newerMarker = screen.getByLabelText('Jul 15, 2026 · 2 traces (67%)');
      expect(parseFloat(olderMarker.style.left)).toBeLessThan(parseFloat(newerMarker.style.left));
      expect(screen.queryByText(/^birth$/i)).toBeNull();
      expect(screen.queryByText(/^continue$/i)).toBeNull();
      expect(screen.queryByRole('heading', { name: 'History' })).toBeNull();
    });
  });

  describe('when the selected snapshot changes after paging examples', () => {
    it('returns to the first examples page for the new snapshot', async () => {
      usePanelHandlers();
      const { rerenderSnapshot } = renderPanel();
      await screen.findByText('Add this transcript to my workspace.');
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      await screen.findByText('Save the transcript with the project.');

      rerenderSnapshot('new-snapshot-cursor');

      expect(await screen.findByText('Add this transcript to my workspace.')).not.toBeNull();
      expect(screen.getByText('Page 1 of 2')).not.toBeNull();
    });
  });

  describe('when the theme coverage is zero', () => {
    it('drops the stage total from the share sentence', async () => {
      usePanelHandlers({ detail: zeroCoverageThemeDetailResponse });
      renderPanel();

      expect(await screen.findByText('6 traces in this snapshot')).not.toBeNull();
    });
  });

  describe('when the latest history point carries a strong falling trend', () => {
    it('describes the theme as fading', async () => {
      usePanelHandlers({ history: fadingThemeHistoryResponse });
      renderPanel();

      expect(await screen.findByText('First seen Jul 8, 2026 · in 2 snapshots · fading')).not.toBeNull();
    });
  });

  describe('when the history window is truncated by the fetch limit', () => {
    it('reports a lower bound instead of claiming a first-seen date', async () => {
      usePanelHandlers({ history: truncatedThemeHistoryResponse });
      renderPanel();

      expect(await screen.findByText('Active since at least Jul 8, 2026 · in 3+ snapshots · growing')).not.toBeNull();
    });
  });

  describe('when the newest point carries a strong rising trend while counts fall', () => {
    it('trusts the pipeline trend over the raw counts', async () => {
      usePanelHandlers({ history: risingTrendFallingCountsHistoryResponse });
      renderPanel();

      expect(await screen.findByText(/· growing$/)).not.toBeNull();
    });
  });

  describe('when the theme history has a single point', () => {
    it('describes the theme as steady and omits the lifecycle chart', async () => {
      usePanelHandlers({ history: singlePointThemeHistoryResponse });
      renderPanel();

      expect(await screen.findByText('First seen Jul 15, 2026 · in 1 snapshot · steady')).not.toBeNull();
      expect(screen.queryByTestId('trend-chart')).toBeNull();
    });
  });
});
