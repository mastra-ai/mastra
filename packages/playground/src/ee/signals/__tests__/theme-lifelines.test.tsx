// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SankeySignals } from '../sankey-signals';
import { buildThemeLifelines } from '../theme-lifelines-data';
import {
  earlierThemeFlowResponse,
  fourStageThemeFlowResponse,
  landmarkThemeSnapshotsResponse,
} from './fixtures/theme-flow';
import { server } from '@/test/msw-server';

const BASE_URL = window.location.origin;

class ChartResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    const size = { blockSize: 680, inlineSize: 800 };
    const entry = {
      target,
      contentRect: new DOMRectReadOnly(0, 0, 800, 680),
      borderBoxSize: [size],
      contentBoxSize: [size],
      devicePixelContentBoxSize: [size],
    } satisfies ResizeObserverEntry;
    this.callback([entry], this);
  }

  unobserve() {}

  disconnect() {}
}

function renderSankeySignals() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <SankeySignals entityId="support-agent" signalNames={['goal', 'outcome', 'behavior', 'sentiment']} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ChartResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(680);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('buildThemeLifelines', () => {
  describe('when a theme appears in only some landmark flows', () => {
    it('reports one row with points at the landmark indexes where the theme is present', () => {
      const rows = buildThemeLifelines(
        [earlierThemeFlowResponse, fourStageThemeFlowResponse, earlierThemeFlowResponse],
        'goal',
      );
      const legacy = rows.find(row => row.label === 'Legacy support request');

      expect(legacy?.points.map(point => point.snapshotIndex)).toEqual([0, 2]);
      expect(legacy?.points[0]?.share).toBeCloseTo(4 / 50);
      expect(legacy?.points[0]?.traceCount).toBe(4);
    });

    it('orders rows by landmark presence with the most persistent themes first', () => {
      const rows = buildThemeLifelines(
        [earlierThemeFlowResponse, fourStageThemeFlowResponse, earlierThemeFlowResponse],
        'goal',
      );

      const presenceCounts = rows.map(row => row.points.length);
      expect(presenceCounts).toEqual([...presenceCounts].sort((left, right) => right - left));
      expect(rows[0]?.label).not.toBe('Legacy support request');
    });
  });

  describe('when some flows in the run are not loaded yet', () => {
    it('skips unloaded slots without inventing zero-share points', () => {
      const rows = buildThemeLifelines([earlierThemeFlowResponse, undefined, earlierThemeFlowResponse], 'goal');
      const legacy = rows.find(row => row.label === 'Legacy support request');

      expect(legacy?.points.map(point => point.snapshotIndex)).toEqual([0, 2]);
    });
  });
});

describe('SankeySignals view mode tabs', () => {
  describe('when the signals page renders with landmark snapshots', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(landmarkThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const isEarly = snapshotId === 'landmark-1' || snapshotId === 'landmark-2';
          return HttpResponse.json(isEarly ? earlierThemeFlowResponse : fourStageThemeFlowResponse);
        }),
      );
    });

    it('offers Flow, Compare, and Lifelines as tabs with Flow selected', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      const tabs = screen.getAllByRole('tab');

      expect(tabs.map(tab => tab.textContent)).toEqual(['Flow', 'Compare', 'Lifelines']);
      expect(screen.getByRole('tab', { name: 'Flow' }).getAttribute('aria-selected')).toBe('true');
    });
  });
});

describe('SankeySignals lifelines mode', () => {
  describe('when the user switches to the lifelines view', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(landmarkThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const isEarly = snapshotId === 'landmark-1' || snapshotId === 'landmark-2';
          return HttpResponse.json(isEarly ? earlierThemeFlowResponse : fourStageThemeFlowResponse);
        }),
      );
    });

    it('replaces the flow chart with a lifeline section per signal', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));

      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      expect(screen.queryByRole('region', { name: 'Trace signal theme flow' })).toBeNull();
      for (const signalName of ['Goal', 'Outcome', 'Behavior', 'Sentiment']) {
        expect(within(lifelines).getByRole('region', { name: `${signalName} lifelines` })).not.toBeNull();
      }
    });

    it('shows each theme with how many landmarks it appears in', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));

      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      const goalSection = within(lifelines).getByRole('region', { name: 'Goal lifelines' });
      const legacyRow = await within(goalSection).findByRole('listitem', {
        name: 'Legacy support request: present in 2 of 5 landmarks',
      });
      expect(legacyRow).not.toBeNull();
      expect(
        within(goalSection).getByRole('listitem', {
          name: 'Resolve support request: present in 5 of 5 landmarks',
        }),
      ).not.toBeNull();
    });

    it('lists persistent themes before transient ones', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));

      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      const goalSection = within(lifelines).getByRole('region', { name: 'Goal lifelines' });
      await within(goalSection).findByRole('listitem', {
        name: 'Legacy support request: present in 2 of 5 landmarks',
      });

      const rowNames = within(goalSection)
        .getAllByRole('listitem')
        .map(row => row.getAttribute('aria-label'));
      expect(rowNames[rowNames.length - 1]).toBe('Legacy support request: present in 2 of 5 landmarks');
    });

    it('returns to the flow chart when the user switches back', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));
      await screen.findByRole('region', { name: 'Theme lifelines' });
      fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));

      expect(await screen.findByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
      expect(screen.queryByRole('region', { name: 'Theme lifelines' })).toBeNull();
    });
  });
});
