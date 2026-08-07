// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeDetailPanel } from '../theme-detail-panel';
import {
  fadingThemeHistoryResponse,
  firstThemeExamplesResponse,
  longThemeHistoryResponse,
  secondThemeExamplesResponse,
  singlePointThemeHistoryResponse,
  themeDetailResponse,
  themeHistoryResponse,
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
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeDetailPanel
        entityId="support-agent"
        entityType="agent"
        snapshotId="opaque-snapshot-cursor"
        snapshotTotal={snapshotTotal}
        selection={{ signalName: 'goal', themeId: '101', label: 'Add transcript' }}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
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

      fireEvent.focus(screen.getByRole('button', { name: 'goal' }));

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
      expect(screen.getByText('First seen Jul 8, 2026 · in 2 of 4 snapshots · growing')).not.toBeNull();
      expect(screen.getByTestId('trend-chart')).not.toBeNull();
      expect(screen.getByLabelText('Jul 8, 2026 · 1 trace (50%)')).not.toBeNull();
      expect(screen.getByLabelText('Jul 15, 2026 · 2 traces (67%)')).not.toBeNull();
      expect(screen.queryByText(/^birth$/i)).toBeNull();
      expect(screen.queryByText(/^continue$/i)).toBeNull();
      expect(screen.queryByRole('heading', { name: 'History' })).toBeNull();
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

      expect(await screen.findByText('First seen Jul 8, 2026 · in 2 of 4 snapshots · fading')).not.toBeNull();
    });
  });

  describe('when the history spans more snapshots than the selected range', () => {
    it('never reports more snapshots than the range contains', async () => {
      usePanelHandlers({ history: longThemeHistoryResponse });
      renderPanel({ snapshotTotal: 2 });

      expect(await screen.findByText('First seen Jul 8, 2026 · in 2 of 2 snapshots · growing')).not.toBeNull();
    });
  });

  describe('when the theme history has a single point', () => {
    it('describes the theme as steady and omits the lifecycle chart', async () => {
      usePanelHandlers({ history: singlePointThemeHistoryResponse });
      renderPanel();

      expect(await screen.findByText('First seen Jul 15, 2026 · in 1 of 4 snapshots · steady')).not.toBeNull();
      expect(screen.queryByTestId('trend-chart')).toBeNull();
    });
  });
});
