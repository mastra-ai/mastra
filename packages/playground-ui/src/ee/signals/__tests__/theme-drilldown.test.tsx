// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeDetail, useThemeExamples, useThemeHistory, useThemePaths, useThemeSnapshots } from '../hooks';
import { SankeySignals } from '../sankey-signals';
import { buildDrilledThemeFlow, findSelectionStats, findThemeSelectionById } from '../theme-drilldown-data';
import {
  allThemePathsResponse,
  drilldownThemeFlowResponse,
  drilldownThemeSnapshotsResponse,
  firstThemeExamplesResponse,
  firstThemePathsResponse,
  largeThemeFlowResponse,
  missingSelectedThemePathsResponse,
  missingThemeDetailResponse,
  noiseExamplesResponse,
  noiseResponse,
  nonNumericThemeFlowResponse,
  olderDrilldownThemeFlowResponse,
  pathsWithCollapsedOutcomeResponse,
  secondThemeExamplesResponse,
  secondThemePathsResponse,
  singleDrilldownThemeSnapshotsResponse,
  themeDetailResponse,
  themeHistoryResponse,
  twoDrilldownThemeSnapshotsResponse,
} from './fixtures/theme-drilldown';
import { server } from '@/test/msw-server';

const BASE_URL = window.location.origin;
const detailPath = `${BASE_URL}/api/learning/entities/support-agent/themes/101`;

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

function TestQueryProvider({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function expectExactQuery(url: URL, expected: Record<string, string>) {
  expect(Object.fromEntries(url.searchParams)).toEqual(expected);
}

function ControlledSankeySignals({
  selectedThemeId: initialSelectedThemeId,
  onSelectedThemeIdChange,
  onFrameIdChange,
  ...props
}: Partial<ComponentProps<typeof SankeySignals>>) {
  const [selectedThemeId, setSelectedThemeId] = useState(initialSelectedThemeId);
  const handleSelectedThemeIdChange = (themeId: string | undefined) => {
    setSelectedThemeId(themeId);
    onSelectedThemeIdChange?.(themeId);
  };
  const [selectedFrameId, setSelectedFrameId] = useState<string>();
  const snapshotsQuery = useThemeSnapshots(
    props.entityId ?? 'support-agent',
    props.entityType ?? 'agent',
    props.signalNames ?? ['goal', 'outcome', 'behavior'],
    props.dateFrom,
    props.dateTo,
  );
  const snapshots = [...(snapshotsQuery.data?.snapshots ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  const frameId = selectedFrameId ?? snapshots[0]?.snapshotId;
  if (!frameId) return null;

  return (
    <SankeySignals
      entityId="support-agent"
      entityType="agent"
      signalNames={['goal', 'outcome', 'behavior']}
      {...props}
      selectedThemeId={selectedThemeId}
      onSelectedThemeIdChange={handleSelectedThemeIdChange}
      selectedFrameId={frameId}
      onFrameIdChange={nextFrameId => {
        setSelectedFrameId(nextFrameId);
        onFrameIdChange?.(nextFrameId);
      }}
    />
  );
}

function renderSignals(props: Partial<ComponentProps<typeof SankeySignals>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ControlledSankeySignals {...props} />
    </QueryClientProvider>,
  );
}

function useFlowHandlers(onPathsRequest?: () => void) {
  server.use(
    http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
      HttpResponse.json(drilldownThemeSnapshotsResponse),
    ),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
      HttpResponse.json(drilldownThemeFlowResponse),
    ),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, ({ request }) => {
      onPathsRequest?.();
      const offset = new URL(request.url).searchParams.get('offset');
      return HttpResponse.json(offset === '1' ? secondThemePathsResponse : firstThemePathsResponse);
    }),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101`, () =>
      HttpResponse.json(themeDetailResponse),
    ),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101/examples`, ({ request }) => {
      const offset = new URL(request.url).searchParams.get('offset');
      return HttpResponse.json(offset === '5' ? secondThemeExamplesResponse : firstThemeExamplesResponse);
    }),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101/history`, () =>
      HttpResponse.json(themeHistoryResponse),
    ),
  );
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ChartResizeObserver);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(680);
});

afterEach(async () => {
  cleanup();
  // @hello-pangea/dnd removes its accessibility announcer in a zero-delay timer.
  // Let that cleanup run before Vitest tears down this file's jsdom document.
  await new Promise(resolve => setTimeout(resolve, 0));
  vi.restoreAllMocks();
});

describe('Agent Learning theme drilldown hooks', () => {
  describe('when a theme is selected', () => {
    it('fetches detail, examples, and history with their exact query contracts', async () => {
      server.use(
        http.get(detailPath, ({ request }) => {
          expectExactQuery(new URL(request.url), {
            entityType: 'agent',
            signalName: 'goal',
            snapshotId: 'opaque-snapshot-cursor',
          });
          return HttpResponse.json(themeDetailResponse);
        }),
        http.get(`${detailPath}/examples`, ({ request }) => {
          expectExactQuery(new URL(request.url), {
            entityType: 'agent',
            signalName: 'goal',
            snapshotId: 'opaque-snapshot-cursor',
            limit: '20',
            offset: '0',
          });
          return HttpResponse.json(firstThemeExamplesResponse);
        }),
        http.get(`${detailPath}/history`, ({ request }) => {
          expectExactQuery(new URL(request.url), {
            entityType: 'agent',
            signalName: 'goal',
            limit: '100',
          });
          return HttpResponse.json(themeHistoryResponse);
        }),
      );

      const { result } = renderHook(
        () => ({
          detail: useThemeDetail('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', '101'),
          examples: useThemeExamples('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', '101'),
          history: useThemeHistory('support-agent', 'agent', 'goal', '101'),
        }),
        { wrapper: TestQueryProvider },
      );

      await waitFor(() => {
        expect(result.current.detail.data).toEqual(themeDetailResponse);
        expect(result.current.examples.data).toEqual(firstThemeExamplesResponse);
        expect(result.current.history.data).toEqual(themeHistoryResponse);
      });
    });
  });

  describe('when no theme is selected', () => {
    it('does not request detail, examples, or history', async () => {
      let requestCount = 0;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId`, () => {
          requestCount += 1;
          return HttpResponse.json(themeDetailResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId/examples`, () => {
          requestCount += 1;
          return HttpResponse.json(firstThemeExamplesResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId/history`, () => {
          requestCount += 1;
          return HttpResponse.json(themeHistoryResponse);
        }),
      );

      renderHook(
        () => ({
          detail: useThemeDetail('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', undefined),
          examples: useThemeExamples('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', undefined),
          history: useThemeHistory('support-agent', 'agent', 'goal', undefined),
        }),
        { wrapper: TestQueryProvider },
      );

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(requestCount).toBe(0);
    });
  });

  describe('when the selected theme id is not numeric', () => {
    it('does not request theme data or paths', async () => {
      let requestCount = 0;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/:entityId/theme-paths`, () => {
          requestCount += 1;
          return HttpResponse.json(firstThemePathsResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId`, () => {
          requestCount += 1;
          return HttpResponse.json(themeDetailResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId/examples`, () => {
          requestCount += 1;
          return HttpResponse.json(firstThemeExamplesResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId/history`, () => {
          requestCount += 1;
          return HttpResponse.json(themeHistoryResponse);
        }),
      );

      renderHook(
        () => ({
          detail: useThemeDetail('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', 'theme-101'),
          examples: useThemeExamples('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', 'theme-101'),
          history: useThemeHistory('support-agent', 'agent', 'goal', 'theme-101'),
          paths: useThemePaths(
            'support-agent',
            'agent',
            ['goal', 'outcome', 'behavior'],
            'opaque-snapshot-cursor',
            false,
          ),
        }),
        { wrapper: TestQueryProvider },
      );

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(requestCount).toBe(0);
    });
  });

  describe('when examples paginate', () => {
    it('fetches the requested next offset', async () => {
      server.use(
        http.get(`${detailPath}/examples`, ({ request }) => {
          const offset = new URL(request.url).searchParams.get('offset');
          return HttpResponse.json(offset === '1' ? secondThemeExamplesResponse : firstThemeExamplesResponse);
        }),
      );

      const { result, rerender } = renderHook(
        ({ offset }) => useThemeExamples('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', '101', 20, offset),
        { wrapper: TestQueryProvider, initialProps: { offset: 0 } },
      );
      await waitFor(() => expect(result.current.data).toEqual(firstThemeExamplesResponse));

      rerender({ offset: 1 });

      await waitFor(() => expect(result.current.data).toEqual(secondThemeExamplesResponse));
    });
  });

  describe('when the detail response has no theme', () => {
    it('returns the snapshot without throwing', async () => {
      server.use(http.get(detailPath, () => HttpResponse.json(missingThemeDetailResponse)));

      const { result } = renderHook(
        () => useThemeDetail('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', '101'),
        { wrapper: TestQueryProvider },
      );

      await waitFor(() => expect(result.current.data).toEqual(missingThemeDetailResponse));
      expect(result.current.data?.theme).toBeUndefined();
    });
  });

  describe('when a drill-in starts', () => {
    it('fetches every paths page with the opaque snapshot and ordered trace signals', async () => {
      const observedOffsets: string[] = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, ({ request }) => {
          const url = new URL(request.url);
          const offset = url.searchParams.get('offset') ?? '';
          expectExactQuery(url, {
            entityType: 'agent',
            signalNames: 'goal,outcome,behavior',
            snapshotId: 'opaque-snapshot-cursor',
            limit: '500',
            offset,
          });
          observedOffsets.push(offset);
          return HttpResponse.json(offset === '1' ? secondThemePathsResponse : firstThemePathsResponse);
        }),
      );

      const { result } = renderHook(
        () => useThemePaths('support-agent', 'agent', ['goal', 'outcome', 'behavior'], 'opaque-snapshot-cursor', true),
        { wrapper: TestQueryProvider },
      );

      await waitFor(() => expect(result.current.data?.paths).toHaveLength(3));
      expect(observedOffsets).toEqual(['0', '1']);
      expect(result.current.data?.themes).toEqual(firstThemePathsResponse.themes);
    });
  });

  describe('when no drill-in is active', () => {
    it('does not request theme paths', async () => {
      let requestCount = 0;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/:entityId/theme-paths`, () => {
          requestCount += 1;
          return HttpResponse.json(firstThemePathsResponse);
        }),
      );

      renderHook(
        () =>
          useThemePaths('support-agent', 'agent', ['goal', 'outcome', 'behavior'], 'opaque-snapshot-cursor', undefined),
        { wrapper: TestQueryProvider },
      );

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(requestCount).toBe(0);
    });
  });
});

describe('findThemeSelectionById', () => {
  it('returns the matching theme from its signal stage', () => {
    expect(findThemeSelectionById(drilldownThemeFlowResponse, '201')).toEqual({
      kind: 'theme',
      signalName: 'outcome',
      themeId: '201',
      label: 'Transcript added',
    });
  });

  it('does not match other or noise nodes', () => {
    expect(findThemeSelectionById(drilldownThemeFlowResponse, 'flow-goal-other')).toBeUndefined();
    expect(findThemeSelectionById(drilldownThemeFlowResponse, 'flow-behavior-noise')).toBeUndefined();
  });

  it('returns undefined when the theme is absent', () => {
    expect(findThemeSelectionById(drilldownThemeFlowResponse, 'missing-theme')).toBeUndefined();
  });
});

describe('buildDrilledThemeFlow', () => {
  describe('when paths contain the selected theme', () => {
    it('recomputes counts and keeps noise assignments in the drilled flow', () => {
      const result = buildDrilledThemeFlow(drilldownThemeFlowResponse, allThemePathsResponse, [
        { kind: 'theme', signalName: 'goal', themeId: '101', label: 'Add transcript' },
      ]);

      expect(result.snapshot.traceCount).toBe(2);
      expect(result.stages[1]?.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Opened workspace', traceCount: 1, stageShare: 0.5 }),
          expect.objectContaining({ kind: 'noise', traceCount: 1, stageShare: 0.5 }),
        ]),
      );
      expect(result.links).toEqual([
        expect.objectContaining({ traceCount: 1 }),
        expect.objectContaining({ traceCount: 1 }),
      ]);
    });
  });

  describe('when the selected theme was collapsed into other in the overview', () => {
    it('renders the concrete path theme as its own node', () => {
      const result = buildDrilledThemeFlow(drilldownThemeFlowResponse, allThemePathsResponse, [
        { kind: 'theme', signalName: 'goal', themeId: '102', label: 'Search transcripts' },
      ]);

      expect(result.snapshot.traceCount).toBe(1);
      expect(result.stages[0]?.nodes).toEqual([
        expect.objectContaining({ kind: 'theme', themeId: '202', label: 'Transcript located', traceCount: 1 }),
      ]);
      expect(result.stages[0]?.nodes[0]?.nodeId).not.toBe('flow-outcome-other');
    });
  });

  describe('when selection statistics are requested for an active filter', () => {
    it('reports full coverage for a non-empty filtered flow', () => {
      const selection = { kind: 'theme', signalName: 'goal', themeId: '101', label: 'Add transcript' } as const;
      const result = buildDrilledThemeFlow(drilldownThemeFlowResponse, allThemePathsResponse, [selection]);

      expect(findSelectionStats(result, [selection], selection)).toEqual({ traceCount: 2, stageShare: 1 });
    });
  });
});

describe('SankeySignals drill-in', () => {
  describe('when a numeric theme node is activated', () => {
    it('filters the full flow through theme paths and can clear the filter', async () => {
      let pathsRequestCount = 0;
      useFlowHandlers(() => {
        pathsRequestCount += 1;
      });
      renderSignals();
      const themeNode = await screen.findByLabelText(/Add transcript.+2 traces \(67%\)/);
      expect(themeNode.getAttribute('role')).toBe('button');
      expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 3 traces ·');

      fireEvent.click(themeNode);

      const banner = await screen.findByLabelText('Active theme drill-in');
      expect(within(banner).getByText('Goal · Add transcript')).not.toBeNull();
      expect(await within(banner).findByText('Showing the 2 of 3 traces that flow through this theme')).not.toBeNull();
      expect(screen.queryByText('Drill-in: Goal = "Add transcript"')).toBeNull();
      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 2 traces ·'));
      expect(screen.getByTestId('snapshot-summary').textContent).toContain('Filtered · ');
      // Themes outside the drilled paths disappear instead of lingering as
      // zero-count ghosts.
      expect(screen.queryByLabelText(/^Other/)).toBeNull();
      expect(pathsRequestCount).toBe(2);

      fireEvent.click(screen.getByRole('button', { name: 'Clear theme filter' }));

      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 3 traces ·'));
      expect(screen.getAllByLabelText(/^Other/).length).toBeGreaterThan(0);
      expect(screen.queryByLabelText('Active theme drill-in')).toBeNull();
    });

    it('keeps themes revealed from an overview other node interactive', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, () =>
          HttpResponse.json(pathsWithCollapsedOutcomeResponse),
        ),
      );
      renderSignals();

      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));

      expect(await screen.findByRole('button', { name: /Transcript located.+1 trace \(100%\)/ })).not.toBeNull();
    });

    it('opens the details panel and isolates the flow in one click', async () => {
      useFlowHandlers();
      renderSignals();

      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));

      expect(await screen.findByRole('dialog', { name: 'Add transcript' })).not.toBeNull();
      expect(await screen.findByLabelText('Active theme drill-in')).not.toBeNull();
      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('Filtered · '));

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add transcript' })).toBeNull());
      expect(screen.getByLabelText('Active theme drill-in')).not.toBeNull();
      expect(screen.getByTestId('snapshot-summary').textContent).toContain('Filtered · ');
    });

    it('opens theme details from the drill-in banner', async () => {
      useFlowHandlers();
      renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
      const detailsButton = await screen.findByRole('button', { name: 'View theme details for Add transcript' });

      fireEvent.click(detailsButton);

      expect(await screen.findByRole('dialog', { name: 'Add transcript' })).not.toBeNull();
      expect(screen.getByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
      expect(screen.queryByRole('heading', { name: 'Understand what drives every agent interaction' })).toBeNull();
      expect(await screen.findByText('Users want to add a transcript to their workspace.')).not.toBeNull();
      expect(await screen.findByText('Add this transcript to my workspace.')).not.toBeNull();
      expect(await screen.findByRole('heading', { name: 'Trend' })).not.toBeNull();
      expect(screen.queryByText(/^birth$/i)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Clear theme filter' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
      expect(await screen.findByText('Save the transcript with the project.')).not.toBeNull();
    });
  });

  describe('when a Noise node is selected', () => {
    it('opens its definition and summary examples', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise`, ({ request }) => {
          expectExactQuery(new URL(request.url), {
            entityType: 'agent',
            signalName: 'behavior',
            snapshotId: 'opaque-snapshot-cursor',
          });
          return HttpResponse.json(noiseResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise/examples`, ({ request }) => {
          expectExactQuery(new URL(request.url), {
            entityType: 'agent',
            signalName: 'behavior',
            snapshotId: 'opaque-snapshot-cursor',
            limit: '5',
            offset: '0',
          });
          return HttpResponse.json(noiseExamplesResponse);
        }),
      );
      renderSignals();
      const noiseNode = await screen.findByLabelText(/^Noise.+2 traces \(67%\)/);

      fireEvent.click(noiseNode);

      const dialog = await screen.findByRole('dialog', { name: 'Noise' });
      expect(
        within(dialog).getByText(
          'Noise contains trace signal summaries that did not consistently match a recurring theme in this snapshot.',
        ),
      ).not.toBeNull();
      expect(await within(dialog).findByText('2 of 3 traces in this snapshot (67%)')).not.toBeNull();
      expect(within(dialog).queryByText('Stage share')).toBeNull();
      expect(
        await within(dialog).findByText('The agent retried a fetch without establishing a recurring behavior pattern.'),
      ).not.toBeNull();
    });
  });

  describe('when a noise chart node is activated', () => {
    it('opens the Noise details panel for that trace signal instead of a drill-in', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise`, ({ request }) => {
          expectExactQuery(new URL(request.url), {
            entityType: 'agent',
            signalName: 'behavior',
            snapshotId: 'opaque-snapshot-cursor',
          });
          return HttpResponse.json(noiseResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise/examples`, () =>
          HttpResponse.json(noiseExamplesResponse),
        ),
      );
      renderSignals();
      const noiseNode = await screen.findByLabelText(/^Noise.+2 traces \(67%\)/);
      expect(noiseNode.getAttribute('role')).toBe('button');

      fireEvent.click(noiseNode);

      const dialog = await screen.findByRole('dialog', { name: 'Noise' });
      expect(
        await within(dialog).findByText('The agent retried a fetch without establishing a recurring behavior pattern.'),
      ).not.toBeNull();
      expect(screen.queryByLabelText('Active theme drill-in')).toBeNull();
    });
  });

  describe('when the snapshot changes during a drill-in', () => {
    it('keeps the durable filter and shows an empty state when the theme is absent', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(twoDrilldownThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const isOlder = new URL(request.url).searchParams.get('snapshotId') === 'older-opaque-snapshot-cursor';
          return HttpResponse.json(isOlder ? olderDrilldownThemeFlowResponse : drilldownThemeFlowResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, ({ request }) => {
          const isOlder = new URL(request.url).searchParams.get('snapshotId') === 'older-opaque-snapshot-cursor';
          return HttpResponse.json(isOlder ? missingSelectedThemePathsResponse : allThemePathsResponse);
        }),
      );
      renderSignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 4 of 4' }));
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 2 traces ·'));
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 3 of 4' }));

      expect(await screen.findByText(/This theme is not present in the selected snapshot/)).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Clear theme filter' })).not.toBeNull();
    });
  });

  describe('when the agent changes during a drill-in', () => {
    it('clears the filter before loading the new agent', async () => {
      let replacementPathsRequests = 0;
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/replacement-agent/theme-snapshots`, () =>
          HttpResponse.json(drilldownThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/replacement-agent/theme-flow`, () =>
          HttpResponse.json(drilldownThemeFlowResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/replacement-agent/theme-paths`, () => {
          replacementPathsRequests += 1;
          return HttpResponse.json(allThemePathsResponse);
        }),
      );
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const result = render(
        <QueryClientProvider client={queryClient}>
          <ControlledSankeySignals key="support-agent" entityId="support-agent" />
        </QueryClientProvider>,
      );
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await screen.findByLabelText('Active theme drill-in');

      result.rerender(
        <QueryClientProvider client={queryClient}>
          <ControlledSankeySignals key="replacement-agent" entityId="replacement-agent" />
        </QueryClientProvider>,
      );

      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 3 traces ·'));
      expect(screen.queryByLabelText('Active theme drill-in')).toBeNull();
      expect(replacementPathsRequests).toBe(0);
    });
  });

  describe('when only one snapshot exists', () => {
    it('omits the theme trend from the detail panel', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(singleDrilldownThemeSnapshotsResponse),
        ),
      );
      renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'View theme details for Add transcript' }));
      await screen.findByRole('dialog', { name: 'Add transcript' });

      expect(screen.queryByRole('heading', { name: 'Trend' })).toBeNull();
    });
  });

  describe('when theme selection is controlled', () => {
    it('opens the selected theme and reports changes to the host', async () => {
      useFlowHandlers();
      const onSelectedThemeIdChange = vi.fn();
      const view = renderSignals({ selectedThemeId: '101', onSelectedThemeIdChange });

      expect(await screen.findByRole('dialog', { name: 'Add transcript' })).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onSelectedThemeIdChange).toHaveBeenCalledWith(undefined);

      view.rerender(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <SankeySignals
            entityId="support-agent"
            entityType="agent"
            signalNames={['goal', 'outcome', 'behavior']}
            selectedThemeId={undefined}
            onSelectedThemeIdChange={onSelectedThemeIdChange}
            selectedFrameId="opaque-snapshot-cursor"
            onFrameIdChange={() => {}}
          />
        </QueryClientProvider>,
      );
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add transcript' })).toBeNull());

      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      expect(onSelectedThemeIdChange).toHaveBeenCalledWith('101');
    });
  });

  describe('when the theme detail panel closes', () => {
    it('restores focus to the invoking control', async () => {
      useFlowHandlers();
      renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add transcript' })).toBeNull());
      const trigger = await screen.findByRole('button', { name: 'View theme details for Add transcript' });
      trigger.focus();
      fireEvent.click(trigger);
      await screen.findByRole('dialog', { name: 'Add transcript' });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  });

  describe('when the selected theme is absent from the snapshot', () => {
    it('shows a not-present state instead of an error', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101`, () =>
          HttpResponse.json(missingThemeDetailResponse),
        ),
      );
      renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'View theme details for Add transcript' }));

      expect(await screen.findByText('Not present in this snapshot')).not.toBeNull();
      expect(screen.queryByText('Unable to load theme details.')).toBeNull();
    });
  });

  describe('when paths fail during a drill-in', () => {
    it('keeps a clear action available', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, () =>
          HttpResponse.json({ error: 'failed' }, { status: 500 }),
        ),
      );
      renderSignals();

      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));

      expect(await screen.findByText('Unable to load trace signal flow.')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Clear filter' })).not.toBeNull();
    });

    it('returns to the overview after clearing the failed drill-in', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, () =>
          HttpResponse.json({ error: 'failed' }, { status: 500 }),
        ),
      );
      renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await screen.findByText('Unable to load trace signal flow.');

      fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 3 traces ·'));
      expect(screen.queryByText('Unable to load trace signal flow.')).toBeNull();
    });

    it('stops snapshot playback after the paths request fails', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(twoDrilldownThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          if (!snapshotId) return HttpResponse.json({ error: 'Missing snapshot' }, { status: 400 });
          return HttpResponse.json({
            ...drilldownThemeFlowResponse,
            snapshot: { ...drilldownThemeFlowResponse.snapshot, snapshotId },
          });
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          if (snapshotId === 'older-opaque-snapshot-cursor') {
            return HttpResponse.json({ error: 'Paths failed' }, { status: 500 });
          }
          return HttpResponse.json(allThemePathsResponse);
        }),
      );
      renderSignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 4 of 4' }));
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 2 traces ·'));

      fireEvent.click(screen.getByRole('button', { name: 'Play snapshots' }));
      await screen.findByRole('button', { name: 'Retry' }, { timeout: 2000 });
      await new Promise(resolve => window.setTimeout(resolve, 1100));

      expect(screen.getByText('Unable to load trace signal flow.')).not.toBeNull();
    });
  });

  describe('when a durable filter moves to a snapshot above the client limit', () => {
    it('does not request paths for the large snapshot', async () => {
      const requestedSnapshotIds: string[] = [];
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(twoDrilldownThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, async ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          if (snapshotId === 'older-opaque-snapshot-cursor') {
            await delay(50);
            return HttpResponse.json({
              ...largeThemeFlowResponse,
              snapshot: { ...olderDrilldownThemeFlowResponse.snapshot, traceCount: 2001 },
            });
          }
          return HttpResponse.json(drilldownThemeFlowResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, ({ request }) => {
          requestedSnapshotIds.push(new URL(request.url).searchParams.get('snapshotId') ?? '');
          return HttpResponse.json(allThemePathsResponse);
        }),
      );
      renderSignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 4 of 4' }));
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 2 traces ·'));
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 3 of 4' }));
      expect(await screen.findByText('Filters unavailable for this snapshot')).not.toBeNull();

      expect(screen.queryByLabelText('Trace signal distributions')).toBeNull();
      expect(screen.getByLabelText('Trace signal theme flow')).not.toBeNull();
      expect(requestedSnapshotIds).not.toContain('older-opaque-snapshot-cursor');
    });
  });

  describe('when the snapshot changes while theme details are paginated', () => {
    it('starts the new snapshot at the first examples page', async () => {
      const observedExampleQueries: Array<{ snapshotId: string; offset: string }> = [];
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(twoDrilldownThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const isOlder = new URL(request.url).searchParams.get('snapshotId') === 'older-opaque-snapshot-cursor';
          return HttpResponse.json(isOlder ? olderDrilldownThemeFlowResponse : drilldownThemeFlowResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101/examples`, ({ request }) => {
          const url = new URL(request.url);
          observedExampleQueries.push({
            snapshotId: url.searchParams.get('snapshotId') ?? '',
            offset: url.searchParams.get('offset') ?? '',
          });
          return HttpResponse.json(
            url.searchParams.get('offset') === '5' ? secondThemeExamplesResponse : firstThemeExamplesResponse,
          );
        }),
      );
      renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'View theme details for Add transcript' }));
      fireEvent.click(screen.getByRole('button', { name: 'Clear theme filter' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
      await screen.findByText('Save the transcript with the project.');
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 3 of 4' }));
      await waitFor(() =>
        expect(observedExampleQueries).toContainEqual({ snapshotId: 'older-opaque-snapshot-cursor', offset: '0' }),
      );
    });
  });

  describe('when an overview other node is rendered', () => {
    it('does not expose activation semantics or request paths', async () => {
      let pathsRequestCount = 0;
      useFlowHandlers(() => {
        pathsRequestCount += 1;
      });
      renderSignals();
      const otherNodes = await screen.findAllByLabelText('Other: 1 trace (33%)');

      expect(otherNodes.every(node => node.getAttribute('role') === null)).toBe(true);
      expect(screen.queryByLabelText('Active theme drill-in')).toBeNull();
      expect(pathsRequestCount).toBe(0);
    });
  });

  describe('when the snapshot exceeds the client drill-in limit', () => {
    it('opens theme details without isolating the flow or requesting paths', async () => {
      let pathsRequestCount = 0;
      useFlowHandlers(() => {
        pathsRequestCount += 1;
      });
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(largeThemeFlowResponse),
        ),
      );
      renderSignals();

      expect(
        await screen.findByTitle('Drill-in is unavailable for snapshots with more than 2,000 traces.'),
      ).not.toBeNull();

      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces/ }));

      expect(await screen.findByRole('dialog', { name: 'Add transcript' })).not.toBeNull();
      expect(screen.queryByLabelText('Active theme drill-in')).toBeNull();
      expect(pathsRequestCount).toBe(0);
    });
  });

  describe('when a theme id is not numeric', () => {
    it('does not expose activation semantics or request paths', async () => {
      let pathsRequestCount = 0;
      useFlowHandlers(() => {
        pathsRequestCount += 1;
      });
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(nonNumericThemeFlowResponse),
        ),
      );
      renderSignals();
      const themeNode = await screen.findByLabelText('Legacy theme: 1 trace (33%)');

      expect(themeNode.getAttribute('role')).toBeNull();
      expect(screen.queryByLabelText('Active theme drill-in')).toBeNull();
      expect(pathsRequestCount).toBe(0);
    });
  });
});
