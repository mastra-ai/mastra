// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeSnapshots } from '../hooks/use-theme-snapshots';
import { SankeySignals } from '../sankey-signals';
import { timelineTickPositions } from '../snapshot-timeline-data';
import { computeThemeShareDeltas, themeShareSeries } from '../theme-compare-data';
import {
  earlierThemeFlowResponse,
  fourStageThemeFlowResponse,
  landmarkThemeSnapshotsResponse,
  multiThemeSnapshotsResponse,
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

function requiredElementAt(elements: HTMLElement[], index: number) {
  const element = elements[index];
  if (!element) throw new Error(`Expected an element at index ${index}`);
  return element;
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

describe('computeThemeShareDeltas', () => {
  describe('when a theme is present at A but missing at B', () => {
    it('marks the theme gone with its full negative share delta', () => {
      const deltas = computeThemeShareDeltas(earlierThemeFlowResponse, fourStageThemeFlowResponse, 'goal');
      const legacy = deltas.find(delta => delta.label === 'Legacy support request');

      expect(legacy).toMatchObject({ isGone: true, isNew: false, toShare: 0 });
      expect(legacy?.fromShare).toBeCloseTo(4 / 50);
      expect(legacy?.delta).toBeCloseTo(-4 / 50);
    });

    it('marks the mirrored comparison as new', () => {
      const deltas = computeThemeShareDeltas(fourStageThemeFlowResponse, earlierThemeFlowResponse, 'goal');
      const legacy = deltas.find(delta => delta.label === 'Legacy support request');

      expect(legacy).toMatchObject({ isNew: true, isGone: false, fromShare: 0 });
    });

    it('orders themes by absolute share movement', () => {
      const deltas = computeThemeShareDeltas(earlierThemeFlowResponse, fourStageThemeFlowResponse, 'goal');

      const magnitudes = deltas.map(delta => Math.abs(delta.delta));
      expect(magnitudes).toEqual([...magnitudes].sort((left, right) => right - left));
    });

    it('carries the theme id from whichever side still has the theme', () => {
      const deltas = computeThemeShareDeltas(earlierThemeFlowResponse, fourStageThemeFlowResponse, 'goal');

      expect(deltas.find(delta => delta.label === 'Legacy support request')?.themeId).toBe('theme-goal-legacy');
      expect(deltas.find(delta => delta.label === 'Resolve support request')?.themeId).toBe('theme-goal-support');
    });
  });
});

describe('themeShareSeries', () => {
  describe('when some flows in the run are not loaded yet', () => {
    it('keeps unloaded slots undefined while reporting shares for loaded flows', () => {
      const series = themeShareSeries(
        [earlierThemeFlowResponse, undefined, fourStageThemeFlowResponse],
        'goal',
        'Legacy support request',
      );

      expect(series[0]).toBeCloseTo(4 / 50);
      expect(series[1]).toBeUndefined();
      expect(series[2]).toBe(0);
    });
  });
});

describe('timelineTickPositions', () => {
  describe('when snapshots carry bursty cutoff timestamps', () => {
    it('places ticks proportionally to cutoff time with the endpoints pinned', () => {
      const positions = timelineTickPositions(landmarkThemeSnapshotsResponse.snapshots);

      expect(positions[0]).toBe(0);
      expect(positions[4]).toBe(100);
      // Landmark 4 (Jul 7 18:00 of a Jul 1 04:00 → Jul 8 00:00 range) sits in
      // the final burst rather than at the 75% index position.
      expect(positions[3]).toBeGreaterThan(90);
    });
  });

  describe('when snapshots have no cutoff timestamps', () => {
    it('falls back to even index spacing', () => {
      const positions = timelineTickPositions(multiThemeSnapshotsResponse.snapshots);

      expect(positions).toEqual([0, 100]);
    });
  });
});

describe('SankeySignals compare mode', () => {
  describe('when the user switches to compare mode', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(multiThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          return HttpResponse.json(snapshotId === 'snapshot-3' ? earlierThemeFlowResponse : fourStageThemeFlowResponse);
        }),
      );
    });

    it('replaces the flow chart with A/B delta columns for every signal', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));

      const comparison = await screen.findByRole('region', { name: 'Snapshot comparison' });
      expect(screen.queryByRole('region', { name: 'Trace signal theme flow' })).toBeNull();
      for (const signalName of ['Goal', 'Outcome', 'Behavior', 'Sentiment']) {
        expect(within(comparison).getByRole('region', { name: `${signalName} changes` })).not.toBeNull();
      }
    });

    it('compares the first and last landmarks by default with date, trace, and theme summaries', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));

      const comparison = await screen.findByRole('region', { name: 'Snapshot comparison' });
      expect(await within(comparison).findByText('Jun 24–Jul 1, 2026 · 50 traces · 10 themes')).not.toBeNull();
      expect(within(comparison).getByText('Jul 1–8, 2026 · 50 traces · 9 themes')).not.toBeNull();
      expect(within(comparison).queryByText(/snapshot \d/)).toBeNull();
    });

    it('shows a gone theme with its share movement and no status badge', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));

      const goalColumn = await screen.findByRole('region', { name: 'Goal changes' });
      const legacyRow = within(goalColumn).getByTitle('Legacy support request').closest('li');
      if (!legacyRow) throw new Error('Legacy support request row was not rendered');
      expect(within(legacyRow).getByText('-8%')).not.toBeNull();
      expect(within(legacyRow).getByText('8% → 0%')).not.toBeNull();
      expect(within(legacyRow).queryByText('GONE')).toBeNull();
      expect(within(goalColumn).queryByText('NEW')).toBeNull();
      // Marker dots render as HTML overlays, not stretched svg circles.
      expect(legacyRow.querySelectorAll('circle')).toHaveLength(0);
    });

    it('opens the theme details panel when a delta card is clicked', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
      const goalColumn = await screen.findByRole('region', { name: 'Goal changes' });
      fireEvent.click(
        await within(goalColumn).findByRole('button', { name: 'View theme details for Legacy support request' }),
      );

      expect(await screen.findByRole('dialog', { name: 'Legacy support request' })).not.toBeNull();
    });

    it('renders two identical compare points without A/B chips or badges', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));

      const comparison = await screen.findByRole('region', { name: 'Snapshot comparison' });
      const track = within(comparison).getByRole('group', { name: 'Snapshot landmarks' });
      const markedTicks = within(track)
        .getAllByRole('button', { name: /Snapshot \d+ of/ })
        .filter(tick => tick.getAttribute('data-marker'));
      expect(markedTicks.map(tick => tick.getAttribute('data-marker'))).toEqual(['compare-point', 'compare-point']);
      expect(within(comparison).queryByRole('button', { name: /Point A/ })).toBeNull();
      expect(within(comparison).queryByRole('button', { name: /Point B/ })).toBeNull();
      expect(within(track).queryByText('A')).toBeNull();
      expect(within(track).queryByText('B')).toBeNull();
      // Snapshot summaries stay visible as plain text, not buttons.
      const summary = await within(comparison).findByText('Jun 24–Jul 1, 2026 · 50 traces · 10 themes');
      expect(summary.closest('button')).toBeNull();
    });

    it('shows the pick-two message after dropping a grabbed point on the other point', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
      const comparison = await screen.findByRole('region', { name: 'Snapshot comparison' });

      const track = within(comparison).getByRole('group', { name: 'Snapshot landmarks' });
      const ticks = within(track).getAllByRole('button', { name: /Snapshot \d+ of/ });
      // Grab the first point, then drop it on the second point's landmark.
      const firstTick = requiredElementAt(ticks, 0);
      fireEvent.click(firstTick);
      expect(firstTick.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(requiredElementAt(ticks, ticks.length - 1));

      expect(
        await within(comparison).findByText('Pick two different landmarks on the timeline to compare them.'),
      ).not.toBeNull();
    });

    it('describes the goal signal from its column heading', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
      const goalColumn = await screen.findByRole('region', { name: 'Goal changes' });
      fireEvent.focus(within(goalColumn).getByRole('button', { name: 'goal' }));

      expect((await screen.findByRole('tooltip')).textContent).toContain('What the user wanted');
    });

    it('returns to the flow chart when the user switches back', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
      await screen.findByRole('region', { name: 'Snapshot comparison' });

      fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));

      expect(await screen.findByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
      expect(screen.queryByRole('region', { name: 'Snapshot comparison' })).toBeNull();
    });
  });

  describe('when an intermediate landmark flow is still loading', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(landmarkThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, async ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          if (snapshotId === 'landmark-3') await delay('infinite');
          return HttpResponse.json(fourStageThemeFlowResponse);
        }),
      );
    });

    it('does not connect the sparkline across the unloaded snapshot', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));

      const goalColumn = await screen.findByRole('region', { name: 'Goal changes' });
      const themeRow = within(goalColumn).getByTitle('Resolve support request').closest('li');
      if (!themeRow) throw new Error('Resolve support request row was not rendered');

      await waitFor(() => expect(themeRow.querySelectorAll('polyline')).toHaveLength(2));
    });
  });

  describe('when compare spans bursty landmark snapshots', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(landmarkThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(fourStageThemeFlowResponse),
        ),
      );
    });

    it('moves the nearest point when an unmarked landmark is clicked', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
      const comparison = await screen.findByRole('region', { name: 'Snapshot comparison' });
      expect(await within(comparison).findByText(/^Jul 8, 2026, 00:00/)).not.toBeNull();

      const track = within(comparison).getByRole('group', { name: 'Snapshot landmarks' });
      const ticks = within(track).getAllByRole('button', { name: /Snapshot \d+ of/ });
      // Landmark 4 sits in the final burst (>90% along the track), so the
      // later point is nearest and moves; the earlier point stays put.
      fireEvent.click(requiredElementAt(ticks, 3));

      expect(await within(comparison).findByText(/^Jul 7, 2026, 18:00/)).not.toBeNull();
      expect(within(comparison).getByText(/^Jul 1, 2026, 04:00/)).not.toBeNull();
      expect(within(comparison).queryByText(/^Jul 8, 2026, 00:00/)).toBeNull();
    });

    it('moves the grabbed point even when the other point is nearer', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
      const comparison = await screen.findByRole('region', { name: 'Snapshot comparison' });
      await within(comparison).findByText(/^Jul 8, 2026, 00:00/);

      const track = within(comparison).getByRole('group', { name: 'Snapshot landmarks' });
      const ticks = within(track).getAllByRole('button', { name: /Snapshot \d+ of/ });
      // Grab the first point, then click a landmark nearest to the *other*
      // point — the grab wins and the first point jumps past the midpoint.
      fireEvent.click(requiredElementAt(ticks, 0));
      fireEvent.click(requiredElementAt(ticks, 3));

      expect(await within(comparison).findByText(/^Jul 7, 2026, 18:00/)).not.toBeNull();
      expect(within(comparison).getByText(/^Jul 8, 2026, 00:00/)).not.toBeNull();
      expect(within(comparison).queryByText(/^Jul 1, 2026, 04:00/)).toBeNull();
    });
  });
});
