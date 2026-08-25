// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeSnapshots } from '../hooks/use-theme-snapshots';
import { SankeySignals } from '../sankey-signals';
import { buildThemeLifelines, lifelineConnectors, lifelineSegments } from '../theme-lifelines-data';
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

function ControlledSankeySignals() {
  const [selectedThemeId, setSelectedThemeId] = useState<string>();
  const [selectedFrameId, setSelectedFrameId] = useState<string>();
  const snapshotsQuery = useThemeSnapshots('support-agent', 'agent', ['goal', 'outcome', 'behavior', 'sentiment']);
  const snapshots = [...(snapshotsQuery.data?.snapshots ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  const frameId = selectedFrameId ?? snapshots[0]?.snapshotId;
  if (!frameId) return null;
  return (
    <SankeySignals
      entityId="support-agent"
      signalNames={['goal', 'outcome', 'behavior', 'sentiment']}
      selectedThemeId={selectedThemeId}
      onSelectedThemeIdChange={setSelectedThemeId}
      selectedFrameId={frameId}
      onFrameIdChange={setSelectedFrameId}
    />
  );
}

function renderSankeySignals() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ControlledSankeySignals />
    </QueryClientProvider>,
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

  describe('when the contributing theme nodes carry theme ids', () => {
    it('keeps each presence point resolvable to its theme id', () => {
      const rows = buildThemeLifelines([fourStageThemeFlowResponse], 'goal');
      const resolve = rows.find(row => row.label === 'Resolve support request');

      expect(resolve?.points[0]?.themeId).toBe('theme-goal-support');
    });
  });
});

describe('lifelineSegments', () => {
  describe('when a theme is present at consecutive landmarks with a gap', () => {
    it('groups consecutive points into runs and drops single-point runs', () => {
      const points = [
        { snapshotIndex: 0, share: 0.5, traceCount: 5 },
        { snapshotIndex: 1, share: 0.4, traceCount: 4 },
        { snapshotIndex: 3, share: 0.6, traceCount: 6 },
      ];

      const segments = lifelineSegments(points);

      expect(segments.map(segment => segment.map(point => point.snapshotIndex))).toEqual([[0, 1]]);
    });
  });
});

describe('lifelineConnectors', () => {
  describe('when a theme is present at consecutive landmarks', () => {
    it('links each adjacent pair of points', () => {
      const points = [
        { snapshotIndex: 3, share: 0.5, traceCount: 5 },
        { snapshotIndex: 4, share: 0.4, traceCount: 4 },
        { snapshotIndex: 5, share: 0.6, traceCount: 6 },
      ];

      const connectors = lifelineConnectors(points);

      expect(connectors.map(connector => [connector.from.snapshotIndex, connector.to.snapshotIndex])).toEqual([
        [3, 4],
        [4, 5],
      ]);
    });
  });

  describe('when the theme skips landmarks in between', () => {
    it('leaves the gap unconnected so absence stays visible', () => {
      const points = [
        { snapshotIndex: 0, share: 0.5, traceCount: 5 },
        { snapshotIndex: 2, share: 0.4, traceCount: 4 },
      ];

      expect(lifelineConnectors(points)).toEqual([]);
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

    it('shows a retryable error when one landmark flow fails', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      let failedLandmarkAttempts = 0;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          if (snapshotId === 'landmark-3' && failedLandmarkAttempts === 0) {
            failedLandmarkAttempts += 1;
            return new HttpResponse(undefined, { status: 500 });
          }
          const isEarly = snapshotId === 'landmark-1' || snapshotId === 'landmark-2';
          return HttpResponse.json(isEarly ? earlierThemeFlowResponse : fourStageThemeFlowResponse);
        }),
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));

      const error = await screen.findByRole('alert');
      expect(error.textContent).toContain('Unable to load theme lifelines.');
      fireEvent.click(within(error).getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('region', { name: 'Theme lifelines' })).not.toBeNull();
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

    it('collapses and reopens a signal section from its header', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));

      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      const goalSection = within(lifelines).getByRole('region', { name: 'Goal lifelines' });
      await within(goalSection).findByRole('listitem', {
        name: 'Legacy support request: present in 2 of 5 landmarks',
      });
      const goalToggle = within(goalSection).getByRole('button', { name: 'goal' });
      expect(goalToggle.getAttribute('aria-expanded')).toBe('true');

      fireEvent.click(goalToggle);

      expect(goalToggle.getAttribute('aria-expanded')).toBe('false');
      expect(within(goalSection).queryAllByRole('listitem')).toHaveLength(0);
      // Other sections stay open.
      const outcomeSection = within(lifelines).getByRole('region', { name: 'Outcome lifelines' });
      expect(within(outcomeSection).getAllByRole('listitem').length).toBeGreaterThan(0);

      fireEvent.click(goalToggle);

      expect(
        within(goalSection).getByRole('listitem', { name: 'Legacy support request: present in 2 of 5 landmarks' }),
      ).not.toBeNull();
    });

    it('describes the goal signal from its section heading', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));
      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      const goalSection = within(lifelines).getByRole('region', { name: 'Goal lifelines' });
      fireEvent.focus(within(goalSection).getByRole('button', { name: 'goal' }));

      expect((await screen.findByRole('tooltip')).textContent).toContain('What the user wanted');
    });

    it('reuses the shared landmark timeline above the lifeline rows', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));

      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      const track = within(lifelines).getByRole('group', { name: 'Snapshot landmarks' });
      expect(within(track).getAllByRole('button', { name: /Snapshot \d+ of/ })).toHaveLength(
        landmarkThemeSnapshotsResponse.snapshots.length,
      );
    });

    it('keeps the landmark picked on the timeline in sync with the flow view', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));
      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      fireEvent.click(within(lifelines).getByRole('button', { name: /Snapshot 1 of/ }));
      fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));

      const flowTimeline = await screen.findByRole('region', { name: 'Snapshot timeline' });
      const selectedTick = within(flowTimeline).getByRole('button', { name: /Snapshot 1 of/ });
      expect(selectedTick.getAttribute('aria-current')).toBe('true');
    });

    it('opens the theme details panel when a lifeline point is clicked', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));
      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      const goalSection = within(lifelines).getByRole('region', { name: 'Goal lifelines' });
      const row = await within(goalSection).findByRole('listitem', {
        name: 'Resolve support request: present in 5 of 5 landmarks',
      });
      const firstPoint = within(row)
        .getAllByRole('button', { name: /^Resolve support request ·/ })
        .at(0);
      if (!firstPoint) throw new Error('Expected a lifeline point');
      fireEvent.click(firstPoint);

      expect(await screen.findByRole('dialog', { name: 'Resolve support request' })).not.toBeNull();
    });

    it('fills the area under a theme row that spans consecutive landmarks', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));

      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      const goalSection = within(lifelines).getByRole('region', { name: 'Goal lifelines' });
      const persistentRow = await within(goalSection).findByRole('listitem', {
        name: 'Resolve support request: present in 5 of 5 landmarks',
      });
      // 5 consecutive presence points → one continuous filled area.
      expect(persistentRow.querySelectorAll('polygon')).toHaveLength(1);
      // Present at consecutive landmarks 1–2 → one short filled area.
      const legacyRow = within(goalSection).getByRole('listitem', {
        name: 'Legacy support request: present in 2 of 5 landmarks',
      });
      expect(legacyRow.querySelectorAll('polygon')).toHaveLength(1);
    });

    it('shows the point tooltip immediately on hover', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));
      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      const goalSection = within(lifelines).getByRole('region', { name: 'Goal lifelines' });
      const row = await within(goalSection).findByRole('listitem', {
        name: 'Resolve support request: present in 5 of 5 landmarks',
      });
      const point = within(row)
        .getAllByRole('button', { name: /^Resolve support request ·/ })
        .at(0);
      if (!point) throw new Error('Expected a lifeline point');

      fireEvent.mouseEnter(point);

      // Real timers, no advancement: the tooltip must appear without a hover delay.
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toContain('Resolve support request');
      expect(tooltip.textContent).toContain('traces');

      fireEvent.mouseLeave(point);
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('draws a connecting line between adjacent landmarks within a theme row', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));

      const lifelines = await screen.findByRole('region', { name: 'Theme lifelines' });
      const goalSection = within(lifelines).getByRole('region', { name: 'Goal lifelines' });
      const persistentRow = await within(goalSection).findByRole('listitem', {
        name: 'Resolve support request: present in 5 of 5 landmarks',
      });
      expect(persistentRow.querySelectorAll('line')).toHaveLength(4);
    });

    it('shows date, trace count, and theme count under the shared timeline', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));
      await screen.findByRole('region', { name: 'Theme lifelines' });

      const lifelines = screen.getByRole('region', { name: 'Theme lifelines' });
      const summary = within(lifelines).getByTestId('snapshot-summary');
      expect(summary.textContent).toContain('· 50 traces · 10 themes');
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
