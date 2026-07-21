// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeDetail, useThemeExamples, useThemeHistory, useThemePaths } from '../hooks';
import { SankeySignals } from '../sankey-signals';
import { buildDrilledThemeFlow } from '../theme-drilldown-data';
import {
  allThemePathsResponse,
  drilldownThemeFlowResponse,
  drilldownThemeSnapshotsResponse,
  firstThemeExamplesResponse,
  firstThemePathsResponse,
  largeThemeFlowResponse,
  missingSelectedThemePathsResponse,
  missingThemeDetailResponse,
  nonNumericThemeFlowResponse,
  olderDrilldownThemeFlowResponse,
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

function renderSignals() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SankeySignals entityId="support-agent" entityType="agent" signalNames={['goal', 'outcome', 'behavior']} />
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
      return HttpResponse.json(offset === '1' ? secondThemeExamplesResponse : firstThemeExamplesResponse);
    }),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101/history`, () =>
      HttpResponse.json(themeHistoryResponse),
    ),
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
            'theme-101',
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
    it('fetches every paths page with the opaque snapshot and ordered signals', async () => {
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
        () => useThemePaths('support-agent', 'agent', ['goal', 'outcome', 'behavior'], 'opaque-snapshot-cursor', '101'),
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

describe('buildDrilledThemeFlow', () => {
  describe('when paths contain the selected theme', () => {
    it('recomputes counts and keeps noise assignments in the drilled flow', () => {
      const result = buildDrilledThemeFlow(drilldownThemeFlowResponse, allThemePathsResponse, {
        signalName: 'goal',
        themeId: '101',
        label: 'Add transcript',
      });

      expect(result.snapshot.traceCount).toBe(2);
      expect(result.stages[2]?.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Opened workspace', traceCount: 1, stageShare: 0.5 }),
          expect.objectContaining({ kind: 'noise', traceCount: 1, stageShare: 0.5 }),
        ]),
      );
      expect(result.links).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ traceCount: 2 }),
          expect.objectContaining({ traceCount: 1 }),
        ]),
      );
    });
  });

  describe('when the selected theme was collapsed into other in the overview', () => {
    it('renders the concrete path theme as its own node', () => {
      const result = buildDrilledThemeFlow(drilldownThemeFlowResponse, allThemePathsResponse, {
        signalName: 'goal',
        themeId: '102',
        label: 'Search transcripts',
      });

      expect(result.snapshot.traceCount).toBe(1);
      expect(result.stages[0]?.nodes).toEqual([
        expect.objectContaining({ kind: 'theme', themeId: '102', label: 'Search transcripts', traceCount: 1 }),
      ]);
      expect(result.stages[0]?.nodes[0]?.nodeId).not.toBe('flow-goal-other');
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
      expect(screen.getByText('3 traces analyzed')).not.toBeNull();

      fireEvent.click(themeNode);

      expect(await screen.findByText('Drill-in: Goal = "Add transcript"')).not.toBeNull();
      expect(await screen.findByText('2 traces analyzed')).not.toBeNull();
      expect(pathsRequestCount).toBe(2);

      fireEvent.click(screen.getByRole('button', { name: 'Clear drill-in' }));

      expect(await screen.findByText('3 traces analyzed')).not.toBeNull();
      expect(screen.queryByLabelText('Active theme drill-in')).toBeNull();
    });

    it('opens theme details from the active drill-in', async () => {
      useFlowHandlers();
      renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'View Add transcript theme details' }));

      expect(await screen.findByRole('dialog', { name: 'Add transcript' })).not.toBeNull();
      expect(await screen.findByText('Users want to add a transcript to their workspace.')).not.toBeNull();
      expect(await screen.findByText('Add this transcript to my workspace.')).not.toBeNull();
      expect(await screen.findByText(/^birth$/i)).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Next examples' }));
      expect(await screen.findByText('Save the transcript with the project.')).not.toBeNull();
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
      const { container } = renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await screen.findByText('2 traces analyzed');
      const sliderInput = container.querySelector('input[type="range"]');
      if (!sliderInput) throw new Error('Snapshot slider input was not rendered');

      fireEvent.change(sliderInput, { target: { value: '0' } });

      expect(await screen.findByText(/This theme is not present in the selected snapshot/)).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Clear drill-in' })).not.toBeNull();
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
          <SankeySignals
            key="support-agent"
            entityId="support-agent"
            entityType="agent"
            signalNames={['goal', 'outcome', 'behavior']}
          />
        </QueryClientProvider>,
      );
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await screen.findByText('Drill-in: Goal = "Add transcript"');

      result.rerender(
        <QueryClientProvider client={queryClient}>
          <SankeySignals
            key="replacement-agent"
            entityId="replacement-agent"
            entityType="agent"
            signalNames={['goal', 'outcome', 'behavior']}
          />
        </QueryClientProvider>,
      );

      expect(await screen.findByText(/replacement-agent · Snapshot/)).not.toBeNull();
      expect(screen.queryByLabelText('Active theme drill-in')).toBeNull();
      expect(replacementPathsRequests).toBe(0);
    });
  });

  describe('when only one snapshot exists', () => {
    it('omits theme history from the detail panel', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(singleDrilldownThemeSnapshotsResponse),
        ),
      );
      renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: 'View Add transcript theme details' }));
      await screen.findByRole('dialog', { name: 'Add transcript' });

      expect(screen.queryByRole('heading', { name: 'History' })).toBeNull();
    });
  });

  describe('when the theme detail panel closes', () => {
    it('restores focus to the invoking control', async () => {
      useFlowHandlers();
      renderSignals();
      const trigger = await screen.findByRole('button', { name: 'View Add transcript theme details' });
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
      fireEvent.click(await screen.findByRole('button', { name: 'View Add transcript theme details' }));

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

      expect(await screen.findByText('Unable to load signal flow.')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Clear drill-in' })).not.toBeNull();
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
      const { container } = renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await screen.findByText('2 traces analyzed');
      const sliderInput = container.querySelector('input[type="range"]');
      if (!sliderInput) throw new Error('Snapshot slider input was not rendered');

      fireEvent.change(sliderInput, { target: { value: '0' } });
      expect(
        await screen.findByText(/This drill-in is unavailable for snapshots with more than 2,000 traces/),
      ).not.toBeNull();

      expect(screen.queryByLabelText('Signal distributions')).toBeNull();
      expect(screen.queryByLabelText('Signal theme flow')).toBeNull();
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
            url.searchParams.get('offset') === '1' ? secondThemeExamplesResponse : firstThemeExamplesResponse,
          );
        }),
      );
      const { container } = renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: 'View Add transcript theme details' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Next examples' }));
      await screen.findByText('Save the transcript with the project.');
      const sliderInput = container.querySelector('input[type="range"]');
      if (!sliderInput) throw new Error('Snapshot slider input was not rendered');

      fireEvent.change(sliderInput, { target: { value: '0' } });
      await waitFor(() =>
        expect(observedExampleQueries).toContainEqual({ snapshotId: 'older-opaque-snapshot-cursor', offset: '0' }),
      );
    });
  });

  describe('when a non-theme node is rendered', () => {
    it('does not expose activation semantics or request paths', async () => {
      let pathsRequestCount = 0;
      useFlowHandlers(() => {
        pathsRequestCount += 1;
      });
      renderSignals();
      const otherNodes = await screen.findAllByLabelText('Other: 1 trace (33%)');
      const noiseNode = screen.getByLabelText('Noise: 2 traces (67%)');

      expect(otherNodes.every(node => node.getAttribute('role') === null)).toBe(true);
      expect(noiseNode.getAttribute('role')).toBeNull();
      expect(screen.queryByLabelText('Active theme drill-in')).toBeNull();
      expect(pathsRequestCount).toBe(0);
    });
  });

  describe('when the snapshot exceeds the client drill-in limit', () => {
    it('disables node activation without requesting paths', async () => {
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
      expect(screen.queryByRole('button', { name: /Add transcript.+2 traces/ })).toBeNull();
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
