// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeDetail, useThemeExamples, useThemeHistory, useThemePaths } from '../hooks';
import { SankeySignals } from '../sankey-signals';
import { buildDrilledThemeFlow, mergeVisibleSignalOrder } from '../theme-drilldown-data';
import {
  allThemePathsResponse,
  drilldownThemeFlowResponse,
  drilldownThemeSnapshotsResponse,
  emptyNoiseExamplesResponse,
  firstThemeExamplesResponse,
  firstThemePathsResponse,
  fourSignalThemeFlowResponse,
  fourSignalThemePathsResponse,
  fourSignalThemeSnapshotsResponse,
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
  sentimentNoiseResponse,
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

function renderSignals(
  signalNames: Array<'goal' | 'outcome' | 'behavior' | 'sentiment'> = ['goal', 'outcome', 'behavior'],
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SankeySignals entityId="support-agent" entityType="agent" signalNames={signalNames} />
    </QueryClientProvider>,
  );
}

function useFourSignalFlowHandlers() {
  server.use(
    http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
      HttpResponse.json(fourSignalThemeSnapshotsResponse),
    ),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
      HttpResponse.json(fourSignalThemeFlowResponse),
    ),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, () =>
      HttpResponse.json(fourSignalThemePathsResponse),
    ),
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
        () => useThemePaths('support-agent', 'agent', ['goal', 'outcome', 'behavior'], 'opaque-snapshot-cursor', false),
        { wrapper: TestQueryProvider },
      );

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(requestCount).toBe(0);
    });
  });
});

describe('buildDrilledThemeFlow', () => {
  describe('when paths contain one selected theme', () => {
    it('removes the drilled column and links the newly adjacent stages', () => {
      const result = buildDrilledThemeFlow(drilldownThemeFlowResponse, allThemePathsResponse, [
        { kind: 'theme', signalName: 'goal', themeId: '101', label: 'Add transcript' },
      ]);

      expect(result.snapshot.traceCount).toBe(2);
      expect(result.stages.map(stage => stage.signalName)).toEqual(['outcome', 'behavior']);
      expect(result.stages[1]?.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Opened workspace', traceCount: 1, stageShare: 0.5 }),
          expect.objectContaining({ kind: 'noise', traceCount: 1, stageShare: 0.5 }),
        ]),
      );
      expect(result.links).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceNodeId: 'flow-outcome-201',
            targetNodeId: 'flow-behavior-301',
            traceCount: 1,
          }),
          expect.objectContaining({
            sourceNodeId: 'flow-outcome-201',
            targetNodeId: 'flow-behavior-noise',
            traceCount: 1,
          }),
        ]),
      );
    });
  });

  describe('when two selections match the same path', () => {
    it('AND-filters the paths and leaves the two undrilled stages linked', () => {
      const result = buildDrilledThemeFlow(fourSignalThemeFlowResponse, fourSignalThemePathsResponse, [
        { kind: 'theme', signalName: 'goal', themeId: '101', label: 'Add transcript' },
        { kind: 'noise', signalName: 'behavior' },
      ]);

      expect(result.snapshot.traceCount).toBe(1);
      expect(result.stages.map(stage => stage.signalName)).toEqual(['outcome', 'sentiment']);
      expect(result.links).toEqual([
        expect.objectContaining({
          sourceNodeId: 'flow-outcome-201',
          targetNodeId: 'flow-sentiment-noise',
          traceCount: 1,
        }),
      ]);
    });
  });

  describe('when a noise bucket is selected', () => {
    it('keeps only noise-assigned paths and removes the noise signal column', () => {
      const result = buildDrilledThemeFlow(drilldownThemeFlowResponse, allThemePathsResponse, [
        { kind: 'noise', signalName: 'behavior' },
      ]);

      expect(result.snapshot.traceCount).toBe(2);
      expect(result.stages.map(stage => stage.signalName)).toEqual(['goal', 'outcome']);
      expect(result.links).toHaveLength(2);
    });
  });

  describe('when the selected theme was collapsed into other in the overview', () => {
    it('preserves the concrete path theme identity in a remaining column', () => {
      const result = buildDrilledThemeFlow(drilldownThemeFlowResponse, allThemePathsResponse, [
        { kind: 'theme', signalName: 'outcome', themeId: '202', label: 'Transcript located' },
      ]);

      expect(result.snapshot.traceCount).toBe(1);
      expect(result.stages[0]?.nodes).toEqual([
        expect.objectContaining({ kind: 'theme', themeId: '102', label: 'Search transcripts', traceCount: 1 }),
      ]);
      expect(result.stages[0]?.nodes[0]?.nodeId).not.toBe('flow-goal-other');
    });
  });

  describe('when stacked selections have no path in common', () => {
    it('returns a zero-trace flow over only the undrilled stages', () => {
      const result = buildDrilledThemeFlow(drilldownThemeFlowResponse, allThemePathsResponse, [
        { kind: 'theme', signalName: 'goal', themeId: '102', label: 'Search transcripts' },
        { kind: 'theme', signalName: 'behavior', themeId: '301', label: 'Opened workspace' },
      ]);

      expect(result.snapshot.traceCount).toBe(0);
      expect(result.stages).toEqual([{ signalName: 'outcome', traceCount: 0, nodes: [] }]);
      expect(result.links).toEqual([]);
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

      const banner = await screen.findByLabelText('Active drill-down filters');
      expect(within(banner).getByRole('button', { name: 'View details for Goal · Add transcript' })).not.toBeNull();
      expect(await within(banner).findByText('Showing 2 of 3 traces that match all filters')).not.toBeNull();
      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 2 traces ·'));
      expect(screen.getByTestId('snapshot-summary').textContent).toContain('Filtered · ');
      expect(within(screen.getByLabelText('Trace signal stage legend')).queryByText('Goal')).toBeNull();
      expect(screen.queryByTitle('Other')).toBeNull();
      expect(pathsRequestCount).toBe(2);

      fireEvent.click(screen.getByRole('button', { name: 'Remove Goal · Add transcript filter' }));

      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 3 traces ·'));
      expect(screen.getAllByTitle('Other').length).toBeGreaterThan(0);
      expect(screen.queryByLabelText('Active drill-down filters')).toBeNull();
    });

    it('opens the selected theme from an explicit details action', async () => {
      useFlowHandlers();
      renderSignals();
      fireEvent.click(await screen.findByLabelText(/Add transcript.+2 traces \(67%\)/));

      fireEvent.click(
        within(await screen.findByLabelText('Active drill-down filters')).getByRole('button', {
          name: 'View details for Goal · Add transcript',
        }),
      );

      expect(await screen.findByRole('dialog', { name: 'Add transcript' })).not.toBeNull();
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

    it('opens theme details from the full distribution row', async () => {
      useFlowHandlers();
      renderSignals();
      const detailsRow = await screen.findByRole('button', { name: 'View theme details for Add transcript' });

      expect(detailsRow.textContent).toContain('Add transcript');
      expect(detailsRow.textContent).toContain('2 · 67%');
      expect(screen.queryByText('Details')).toBeNull();
      fireEvent.click(detailsRow);

      expect(await screen.findByRole('dialog', { name: 'Add transcript' })).not.toBeNull();
      expect(screen.getByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
      expect(screen.queryByRole('heading', { name: 'Understand what drives every agent interaction' })).toBeNull();
      expect(await screen.findByText('Users want to add a transcript to their workspace.')).not.toBeNull();
      expect(await screen.findByText('Add this transcript to my workspace.')).not.toBeNull();
      expect(await screen.findByText(/^birth$/i)).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Next examples' }));
      expect(await screen.findByText('Save the transcript with the project.')).not.toBeNull();
    });
  });

  describe('when a Noise row is selected', () => {
    it('shows Noise for every trace signal and opens its definition and summary examples', async () => {
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

      const distributions = await screen.findByLabelText('Trace signal distributions');
      for (const signalName of ['Goal', 'Outcome', 'Behavior']) {
        expect(
          within(within(distributions).getByLabelText(`${signalName} distribution`)).getByRole('button', {
            name: `View Noise details for ${signalName}`,
          }),
        ).not.toBeNull();
      }

      fireEvent.click(screen.getByRole('button', { name: 'View Noise details for Behavior' }));

      const dialog = await screen.findByRole('dialog', { name: 'Noise' });
      expect(
        within(dialog).getByText(
          'Noise contains trace signal summaries that did not consistently match a recurring theme in this snapshot.',
        ),
      ).not.toBeNull();
      expect(await within(dialog).findByText('2')).not.toBeNull();
      expect(within(dialog).getByText('67%')).not.toBeNull();
      expect(
        await within(dialog).findByText('The agent retried a fetch without establishing a recurring behavior pattern.'),
      ).not.toBeNull();
    });
  });

  describe('when a noise chart node is activated', () => {
    it('drills into the noise-assigned traces and removes that signal column', async () => {
      useFlowHandlers();
      renderSignals();
      const noiseNode = await screen.findByLabelText(/^Noise.+2 traces \(67%\)/);
      expect(noiseNode.getAttribute('role')).toBe('button');

      fireEvent.click(noiseNode);

      const banner = await screen.findByLabelText('Active drill-down filters');
      expect(within(banner).getByRole('button', { name: 'View details for Behavior · Noise' })).not.toBeNull();
      expect(await within(banner).findByText('Showing 2 of 3 traces that match all filters')).not.toBeNull();
      expect(within(screen.getByLabelText('Trace signal stage legend')).queryByText('Behavior')).toBeNull();
      expect(screen.queryByRole('dialog', { name: 'Noise' })).toBeNull();
    });
  });

  describe('when a theme and noise selection are stacked', () => {
    it('shows their intersection and recomputes after one chip is removed', async () => {
      useFourSignalFlowHandlers();
      renderSignals(['goal', 'outcome', 'behavior', 'sentiment']);

      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      const noiseNodes = await screen.findAllByRole('button', { name: /^Noise.+1 trace \(50%\)/ });
      fireEvent.click(noiseNodes[0]!);

      const banner = await screen.findByLabelText('Active drill-down filters');
      expect(within(banner).getByRole('button', { name: 'View details for Goal · Add transcript' })).not.toBeNull();
      expect(within(banner).getByRole('button', { name: 'View details for Behavior · Noise' })).not.toBeNull();
      expect(await within(banner).findByText('Showing 1 of 3 traces that match all filters')).not.toBeNull();
      expect(within(screen.getByLabelText('Trace signal stage legend')).queryByText('Goal')).toBeNull();
      expect(within(screen.getByLabelText('Trace signal stage legend')).queryByText('Behavior')).toBeNull();

      fireEvent.click(within(banner).getByRole('button', { name: 'Remove Behavior · Noise filter' }));

      expect(await within(banner).findByText('Showing 2 of 3 traces that match all filters')).not.toBeNull();
      expect(within(screen.getByLabelText('Trace signal stage legend')).getByText('Behavior')).not.toBeNull();
    });

    it('opens details instead of adding a filter that would leave one column', async () => {
      useFourSignalFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/201`, () =>
          HttpResponse.json({
            ...themeDetailResponse,
            theme: { ...themeDetailResponse.theme, themeId: '201', label: 'Transcript added' },
          }),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/201/examples`, () =>
          HttpResponse.json(firstThemeExamplesResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/201/history`, () =>
          HttpResponse.json(themeHistoryResponse),
        ),
      );
      renderSignals(['goal', 'outcome', 'behavior', 'sentiment']);
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      const noiseNodes = await screen.findAllByRole('button', { name: /^Noise.+1 trace \(50%\)/ });
      fireEvent.click(noiseNodes[0]!);
      await screen.findByText('Showing 1 of 3 traces that match all filters');

      fireEvent.click(screen.getByRole('button', { name: /^Transcript added.+1 trace \(100%\)/ }));

      expect(await screen.findByRole('dialog', { name: 'Transcript added' })).not.toBeNull();
      expect(within(screen.getByLabelText('Active drill-down filters')).getAllByText(/Goal|Behavior/)).toHaveLength(2);
    });

    it('shows filtered theme counts and keeps the remaining filters on every examples page', async () => {
      useFourSignalFlowHandlers();
      const observedExampleQueries: Array<Record<string, string>> = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101`, () =>
          HttpResponse.json(themeDetailResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101/examples`, ({ request }) => {
          const query = Object.fromEntries(new URL(request.url).searchParams);
          observedExampleQueries.push(query);
          return HttpResponse.json(query.offset === '1' ? secondThemeExamplesResponse : firstThemeExamplesResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101/history`, () =>
          HttpResponse.json(themeHistoryResponse),
        ),
      );
      renderSignals(['goal', 'outcome', 'behavior', 'sentiment']);
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      const noiseNodes = await screen.findAllByRole('button', { name: /^Noise.+1 trace \(50%\)/ });
      fireEvent.click(noiseNodes[0]!);

      const banner = await screen.findByLabelText('Active drill-down filters');
      fireEvent.click(within(banner).getByRole('button', { name: 'View details for Goal · Add transcript' }));

      const dialog = await screen.findByRole('dialog', { name: 'Add transcript' });
      expect(
        await within(dialog).findByText('Filtered to traces matching the active drill-down filters.'),
      ).not.toBeNull();
      expect(within(dialog).getByText('100%')).not.toBeNull();
      expect(within(dialog).getByText('1')).not.toBeNull();
      await within(dialog).findByText('Add this transcript to my workspace.');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Next examples' }));
      await within(dialog).findByText('Save the transcript with the project.');
      expect(observedExampleQueries).toEqual([
        {
          entityType: 'agent',
          signalName: 'goal',
          snapshotId: 'opaque-snapshot-cursor',
          limit: '5',
          offset: '0',
          filterThemes: 'behavior:noise',
        },
        {
          entityType: 'agent',
          signalName: 'goal',
          snapshotId: 'opaque-snapshot-cursor',
          limit: '5',
          offset: '1',
          filterThemes: 'behavior:noise',
        },
      ]);
    });

    it('shows filtered noise counts and sends the remaining theme filter for examples', async () => {
      useFourSignalFlowHandlers();
      let observedExamplesQuery: Record<string, string> | undefined;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise`, () => HttpResponse.json(noiseResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise/examples`, ({ request }) => {
          observedExamplesQuery = Object.fromEntries(new URL(request.url).searchParams);
          return HttpResponse.json(noiseExamplesResponse);
        }),
      );
      renderSignals(['goal', 'outcome', 'behavior', 'sentiment']);
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      const noiseNodes = await screen.findAllByRole('button', { name: /^Noise.+1 trace \(50%\)/ });
      fireEvent.click(noiseNodes[0]!);

      const banner = await screen.findByLabelText('Active drill-down filters');
      fireEvent.click(within(banner).getByRole('button', { name: 'View details for Behavior · Noise' }));

      const dialog = await screen.findByRole('dialog', { name: 'Noise' });
      expect(
        await within(dialog).findByText('Filtered to traces matching the active drill-down filters.'),
      ).not.toBeNull();
      expect(within(dialog).getByText('100%')).not.toBeNull();
      expect(within(dialog).getByText('1')).not.toBeNull();
      await within(dialog).findByText('The agent retried a fetch without establishing a recurring behavior pattern.');
      expect(observedExamplesQuery).toEqual({
        entityType: 'agent',
        signalName: 'behavior',
        snapshotId: 'opaque-snapshot-cursor',
        limit: '5',
        offset: '0',
        filterThemes: 'goal:101',
      });
    });
  });

  describe('when a noise bucket has no traces under an active filter', () => {
    it('shows zero filtered stats instead of the unfiltered noise stats', async () => {
      useFourSignalFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise`, () =>
          HttpResponse.json(sentimentNoiseResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise/examples`, ({ request }) => {
          expect(new URL(request.url).searchParams.get('filterThemes')).toBe('behavior:301');
          return HttpResponse.json(emptyNoiseExamplesResponse);
        }),
      );
      renderSignals(['goal', 'outcome', 'behavior', 'sentiment']);
      fireEvent.click(await screen.findByRole('button', { name: /^Opened workspace.+1 trace \(33%\)/ }));
      await screen.findByText('Showing 1 of 3 traces that match all filters');

      fireEvent.click(screen.getByRole('button', { name: 'View Noise details for Sentiment' }));

      const dialog = await screen.findByRole('dialog', { name: 'Noise' });
      expect(
        await within(dialog).findByText('Filtered to traces matching the active drill-down filters.'),
      ).not.toBeNull();
      expect(within(dialog).getByText('0%')).not.toBeNull();
      expect(within(dialog).getByText('0')).not.toBeNull();
      expect(within(dialog).getByText('No noise examples in this snapshot.')).not.toBeNull();
      expect(within(dialog).queryByText('33%')).toBeNull();
    });
  });

  describe('when visible signal columns are reordered during a drill-in', () => {
    it('keeps drilled signals in the requested perspective', () => {
      expect(
        mergeVisibleSignalOrder(['goal', 'outcome', 'behavior', 'sentiment'], ['goal', 'behavior', 'outcome']),
      ).toEqual(['goal', 'behavior', 'outcome', 'sentiment']);
    });
  });

  describe('when stacked filters leave only one signal column', () => {
    it('shows a filtered summary instead of a misleading no-flow message', async () => {
      const latestSnapshot = fourSignalThemeSnapshotsResponse.snapshots[0]!;
      const olderSnapshot = {
        ...latestSnapshot,
        snapshotId: 'older-three-signal-snapshot',
        ordinal: latestSnapshot.ordinal - 1,
        availableSignals: ['goal', 'outcome', 'behavior'] as const,
      };
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json({ snapshots: [olderSnapshot, latestSnapshot] }),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const isOlder = new URL(request.url).searchParams.get('snapshotId') === olderSnapshot.snapshotId;
          return HttpResponse.json(isOlder ? drilldownThemeFlowResponse : fourSignalThemeFlowResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, ({ request }) => {
          const isOlder = new URL(request.url).searchParams.get('snapshotId') === olderSnapshot.snapshotId;
          return HttpResponse.json(isOlder ? allThemePathsResponse : fourSignalThemePathsResponse);
        }),
      );
      renderSignals(['goal', 'outcome', 'behavior', 'sentiment']);
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      const noiseNodes = await screen.findAllByRole('button', { name: /^Noise.+1 trace \(50%\)/ });
      fireEvent.click(noiseNodes[0]!);
      await screen.findByText('Showing 1 of 3 traces that match all filters');

      fireEvent.click(
        screen.getByRole('button', { name: `Snapshot ${olderSnapshot.ordinal} of ${olderSnapshot.total}` }),
      );

      expect(await screen.findByText(/1 signal column remains after applying these filters/)).not.toBeNull();
      expect(screen.queryByText(/No cross-signal flow/)).toBeNull();
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
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 2 traces ·'));
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 3 of 4' }));

      expect(await screen.findByText(/These filters have no matching traces in the selected snapshot/)).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Remove Goal · Add transcript filter' })).not.toBeNull();
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
      await screen.findByLabelText('Active drill-down filters');

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

      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 3 traces ·'));
      expect(screen.queryByLabelText('Active drill-down filters')).toBeNull();
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
      fireEvent.click(await screen.findByRole('button', { name: 'View theme details for Add transcript' }));
      await screen.findByRole('dialog', { name: 'Add transcript' });

      expect(screen.queryByRole('heading', { name: 'History' })).toBeNull();
    });
  });

  describe('when the theme detail panel closes', () => {
    it('restores focus to the invoking control', async () => {
      useFlowHandlers();
      renderSignals();
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
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('· 2 traces ·'));
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 3 of 4' }));
      expect(
        await screen.findByText(/These filters are unavailable for snapshots with more than 2,000 traces/),
      ).not.toBeNull();

      expect(screen.queryByLabelText('Trace signal distributions')).toBeNull();
      expect(screen.queryByLabelText('Trace signal theme flow')).toBeNull();
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
      renderSignals();
      fireEvent.click(await screen.findByRole('button', { name: 'View theme details for Add transcript' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Next examples' }));
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
      expect(screen.queryByLabelText('Active drill-down filters')).toBeNull();
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

    it('keeps a noise node available for opening unfiltered details', async () => {
      useFlowHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(largeThemeFlowResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise`, () => HttpResponse.json(noiseResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise/examples`, () =>
          HttpResponse.json(noiseExamplesResponse),
        ),
      );
      renderSignals();

      fireEvent.click(await screen.findByRole('button', { name: /^Noise.+2 traces \(67%\)/ }));

      expect(await screen.findByRole('dialog', { name: 'Noise' })).not.toBeNull();
      expect(screen.queryByLabelText('Active drill-down filters')).toBeNull();
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
      expect(screen.queryByLabelText('Active drill-down filters')).toBeNull();
      expect(pathsRequestCount).toBe(0);
    });
  });
});
