// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SignalsOverviewPage as SignalsEmptyState } from '../components/signals-overview-page';
import { useThemeSnapshots } from '../hooks/use-theme-snapshots';
import { SankeySignals } from '../sankey-signals';
import {
  getSignalRecordNodeId,
  getSignalRecordNodeLabel,
  snapshotSummaryLabel,
  stabilizeThemeFlow,
  themeFlowToSankeyData,
} from '../sankey-signals-data';
import { formatSnapshotCutoff, formatSnapshotWindow } from '../signal-formatting';
import { SignalsErrorState } from '../signals-error-state';
import { SignalsLoadingSkeleton } from '../signals-loading-skeleton';
import type { ThemeFlowResponse } from '../types';
import {
  duplicateLabelThemeFlowResponse,
  earlierThemeFlowResponse,
  emptyThemeSnapshotsResponse,
  fourStageThemeFlowResponse,
  inconsistentTraceCountThemeFlowResponse,
  landmarkThemeSnapshotsResponse,
  multiThemeSnapshotsResponse,
  rangeScopedThemeSnapshotsResponse,
  reorderedFourStageThemeFlowResponse,
  reorderedMultiThemeSnapshotsResponse,
  sameDayThemeSnapshotsResponse,
  singleStageThemeFlowResponse,
  themeFlowResponse,
  themeSnapshotsResponse,
  unlinkedGoalStageThemeFlowResponse,
} from './fixtures/theme-flow';
import { buildSankeyChartGraph } from '@/ds/components/SankeyChart';
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

function ControlledSankeySignals({
  dateFrom,
  dateTo,
  onFrameIdChange,
}: {
  dateFrom?: Date;
  dateTo?: Date;
  onFrameIdChange?: (frameId: string) => void;
}) {
  const [selectedThemeId, setSelectedThemeId] = useState<string>();
  const [selectedFrameId, setSelectedFrameId] = useState<string>();
  const snapshotsQuery = useThemeSnapshots(
    'support-agent',
    'agent',
    ['goal', 'outcome', 'behavior', 'sentiment'],
    dateFrom,
    dateTo,
  );
  const snapshots = [...(snapshotsQuery.data?.snapshots ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  // Mirror the real parent: derive the frame without membership filtering and
  // only mount SankeySignals once a real snapshot id exists.
  const frameId = selectedFrameId ?? snapshots[0]?.snapshotId;
  if (snapshotsQuery.isPending) return <SignalsLoadingSkeleton />;
  if (snapshotsQuery.isError) {
    return (
      <SignalsErrorState message="Unable to load trace signal flow." onRetry={() => void snapshotsQuery.refetch()} />
    );
  }
  if (!frameId) return <SignalsEmptyState isRangeEmpty />;
  return (
    <SankeySignals
      entityId="support-agent"
      signalNames={['goal', 'outcome', 'behavior', 'sentiment']}
      dateFrom={dateFrom}
      dateTo={dateTo}
      selectedThemeId={selectedThemeId}
      onSelectedThemeIdChange={setSelectedThemeId}
      selectedFrameId={frameId}
      onFrameIdChange={nextFrameId => {
        setSelectedFrameId(nextFrameId);
        onFrameIdChange?.(nextFrameId);
      }}
    />
  );
}

function renderSankeySignals({
  dateFrom,
  dateTo,
  onFrameIdChange,
}: { dateFrom?: Date; dateTo?: Date; onFrameIdChange?: (frameId: string) => void } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ControlledSankeySignals dateFrom={dateFrom} dateTo={dateTo} onFrameIdChange={onFrameIdChange} />
    </QueryClientProvider>,
  );
}

function rectangle(left: number, width: number, height: number) {
  return {
    x: left,
    y: 0,
    top: 0,
    right: left + width,
    bottom: height,
    left,
    width,
    height,
    toJSON: () => ({}),
  };
}

async function reorderOutcomeAfterBehavior(beforeDrop?: () => void | Promise<void>) {
  const headerRow = screen.getByLabelText('Trace signal column headers');
  const headers = screen.getAllByTestId('signal-column-header');
  headers.forEach((header, index) => {
    const draggable = header.closest<HTMLElement>('[data-rfd-draggable-id]');
    if (!draggable) throw new Error('Trace signal column header draggable was not rendered');
    vi.spyOn(draggable, 'getBoundingClientRect').mockReturnValue(rectangle(index * 250, 240, 40));
  });
  vi.spyOn(headerRow, 'getBoundingClientRect').mockReturnValue(rectangle(0, 990, 40));
  const outcomeHandle = screen.getByLabelText('Reorder Outcome');
  const outcomeDraggable = outcomeHandle.closest<HTMLElement>('[data-rfd-draggable-id]');
  if (!outcomeDraggable) throw new Error('Outcome column header draggable was not rendered');
  expect(outcomeDraggable.getAttribute('draggable')).not.toBe('true');
  expect(outcomeHandle.getAttribute('draggable')).not.toBe('true');
  fireEvent.mouseDown(outcomeHandle, { button: 0, buttons: 1, clientX: 375, clientY: 20 });
  fireEvent.mouseMove(window, { buttons: 1, clientX: 390, clientY: 20 });
  await waitFor(() => expect(outcomeDraggable.style.position).toBe('fixed'));
  fireEvent.mouseMove(window, { buttons: 1, clientX: 650, clientY: 20 });
  await waitFor(() => expect(outcomeDraggable.style.transform).not.toBe(''));
  await beforeDrop?.();
  fireEvent.mouseUp(window, { button: 0, buttons: 0, clientX: 650, clientY: 20 });
}

function columnHeaderLabels() {
  return screen.getAllByTestId('signal-column-header').map(header => header.textContent);
}

function translatePercent(element: HTMLElement | null | undefined) {
  return Number.parseFloat(element?.style.translate ?? '');
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ChartResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(680);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('snapshotSummaryLabel', () => {
  describe('when the flow holds exactly one theme', () => {
    it('reports the theme count in the singular', () => {
      const firstStage = themeFlowResponse.stages[0];
      const singleThemeFlow: ThemeFlowResponse = {
        ...themeFlowResponse,
        stages: firstStage
          ? [{ ...firstStage, nodes: firstStage.nodes.filter(node => node.kind === 'theme').slice(0, 1) }]
          : [],
        links: [],
      };

      const label = snapshotSummaryLabel(themeSnapshotsResponse.snapshots[0], singleThemeFlow);

      expect(label.endsWith('· 1 theme')).toBe(true);
    });
  });
});

describe('formatSnapshotCutoff', () => {
  describe('when the server sends an unparseable timestamp', () => {
    it('falls back to the raw value instead of throwing', () => {
      expect(formatSnapshotCutoff('not-a-timestamp')).toBe('not-a-timestamp');
    });
  });
});

describe('formatSnapshotWindow', () => {
  describe('when the server sends an unparseable timestamp', () => {
    it('falls back to the raw values instead of throwing', () => {
      expect(formatSnapshotWindow('not-a-timestamp', '2026-07-08T00:00:00.000Z')).toBe(
        'not-a-timestamp–2026-07-08T00:00:00.000Z',
      );
    });
  });
});

describe('stabilizeThemeFlow', () => {
  describe('when snapshot counts change within one timeline window', () => {
    it('keeps link layout weights and node ordering fixed while current link and node counts change', () => {
      const lowerVolumeFlow = {
        ...fourStageThemeFlowResponse,
        snapshot: earlierThemeFlowResponse.snapshot,
        stages: fourStageThemeFlowResponse.stages.map(stage => ({
          ...stage,
          nodes: stage.nodes
            .map(node => ({
              ...node,
              traceCount: Math.max(1, Math.floor(node.traceCount / 2)),
              stageShare: node.stageShare / 2,
            }))
            .reverse(),
        })),
        links: fourStageThemeFlowResponse.links
          .map(link => ({
            ...link,
            traceCount: Math.max(1, Math.floor(link.traceCount / 2)),
            sourceShare: link.sourceShare / 2,
            targetShare: link.targetShare / 2,
          }))
          .reverse(),
      };
      const windowFlows = [lowerVolumeFlow, fourStageThemeFlowResponse];

      const lowerFrame = stabilizeThemeFlow(lowerVolumeFlow, windowFlows);
      const higherFrame = stabilizeThemeFlow(fourStageThemeFlowResponse, windowFlows);

      const getNodeOrder = (frame: typeof lowerFrame) =>
        frame.stages.map(stage => stage.nodes.map(node => node.nodeId));
      const getNodeCounts = (frame: Pick<ThemeFlowResponse, 'stages'>) =>
        frame.stages.map(stage => Object.fromEntries(stage.nodes.map(node => [node.nodeId, node.traceCount])));
      const getLinkCounts = (frame: Pick<ThemeFlowResponse, 'links'>) =>
        Object.fromEntries(frame.links.map(link => [`${link.sourceNodeId}:${link.targetNodeId}`, link.traceCount]));
      const getLayoutLinks = (frame: typeof lowerFrame) =>
        frame.links.map(link => [link.sourceNodeId, link.targetNodeId, link.layoutTraceCount]);
      const expectedNodeOrder = lowerVolumeFlow.stages.map(stage => stage.nodes.map(node => node.nodeId));
      const expectedLayoutLinks = lowerVolumeFlow.links.map(link => {
        const higherLink = fourStageThemeFlowResponse.links.find(
          candidate => candidate.sourceNodeId === link.sourceNodeId && candidate.targetNodeId === link.targetNodeId,
        );
        return [link.sourceNodeId, link.targetNodeId, higherLink?.traceCount];
      });

      expect(getNodeOrder(lowerFrame)).toEqual(expectedNodeOrder);
      expect(getNodeOrder(higherFrame)).toEqual(expectedNodeOrder);
      expect(getLayoutLinks(lowerFrame)).toEqual(expectedLayoutLinks);
      expect(getLayoutLinks(higherFrame)).toEqual(expectedLayoutLinks);
      expect(getNodeCounts(lowerFrame)).toEqual(getNodeCounts(lowerVolumeFlow));
      expect(getNodeCounts(higherFrame)).toEqual(getNodeCounts(fourStageThemeFlowResponse));
      expect(getLinkCounts(lowerFrame)).toEqual(getLinkCounts(lowerVolumeFlow));
      expect(getLinkCounts(higherFrame)).toEqual(getLinkCounts(fourStageThemeFlowResponse));
    });
  });

  describe('when neighboring window flows contain themes absent from the selected snapshot', () => {
    it('omits neighbor-only nodes and links instead of rendering zero-count ghosts', () => {
      const neighborOnlyNode = {
        nodeId: 'goal-neighbor-only',
        kind: 'theme' as const,
        themeId: 'neighbor-only',
        label: 'Neighbor only goal',
        traceCount: 12,
        stageShare: 0.3,
      };
      const neighborFlow = {
        ...earlierThemeFlowResponse,
        stages: earlierThemeFlowResponse.stages.map(stage =>
          stage.signalName === 'goal' ? { ...stage, nodes: [...stage.nodes, neighborOnlyNode] } : stage,
        ),
        links: [
          ...earlierThemeFlowResponse.links,
          {
            sourceNodeId: neighborOnlyNode.nodeId,
            targetNodeId: earlierThemeFlowResponse.stages[1].nodes[0].nodeId,
            traceCount: 12,
            sourceShare: 1,
            targetShare: 0.5,
          },
        ],
      };

      const stable = stabilizeThemeFlow(fourStageThemeFlowResponse, [neighborFlow, fourStageThemeFlowResponse]);

      const nodeIds = stable.stages.flatMap(stage => stage.nodes.map(node => node.nodeId));
      expect(nodeIds).not.toContain(neighborOnlyNode.nodeId);
      expect(stable.stages.flatMap(stage => stage.nodes).every(node => node.traceCount > 0)).toBe(true);
      expect(stable.links.map(link => link.sourceNodeId)).not.toContain(neighborOnlyNode.nodeId);
      expect(stable.links.every(link => link.traceCount > 0)).toBe(true);
    });
  });
});

describe('SankeySignals', () => {
  describe('when the snapshot request is pending', () => {
    it('shows the Trace Intelligence loading state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, async () => {
          await new Promise(() => {});
          return HttpResponse.json(emptyThemeSnapshotsResponse);
        }),
      );

      renderSankeySignals();

      expect(await screen.findByRole('status', { name: 'Loading trace intelligence' })).not.toBeNull();
    });
  });

  describe('when the flow request is pending', () => {
    it('shows the Trace Intelligence loading state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, async () => {
          await new Promise(() => {});
          return HttpResponse.json(themeFlowResponse);
        }),
      );

      renderSankeySignals();

      expect(await screen.findByRole('status', { name: 'Loading trace intelligence' })).not.toBeNull();
      expect(screen.getByTestId('signals-loading-skeleton')).not.toBeNull();
    });
  });

  describe('when only a prefetched neighbor flow is still loading', () => {
    it('renders the selected snapshot flow instead of the loading skeleton', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(multiThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, async ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          // The selected snapshot resolves; its prefetched neighbor never does.
          if (snapshotId === 'snapshot-1') await new Promise(() => {});
          return HttpResponse.json(fourStageThemeFlowResponse);
        }),
      );

      renderSankeySignals();

      expect(await screen.findByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
      expect(screen.queryByTestId('signals-loading-skeleton')).toBeNull();
    });
  });

  describe('when the selected snapshot has no cross-signal links', () => {
    it('explains the missing flow instead of rendering an empty chart', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json({ ...themeFlowResponse, links: [] }),
        ),
      );

      renderSankeySignals();

      expect(await screen.findByText(/No cross-signal flow for this snapshot/)).not.toBeNull();
      expect(screen.queryByText('Select at least two columns with data to display a flow')).toBeNull();
    });
  });

  describe('when a stage has themes but no links touch it', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(unlinkedGoalStageThemeFlowResponse),
        ),
      );
    });

    it('drops the unlinked column from the chart so the first rendered column anchors the layout', async () => {
      renderSankeySignals();

      const flowRegion = await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(within(flowRegion).queryByText('GOAL')).toBeNull();
      expect(within(flowRegion).getByText('OUTCOME')).not.toBeNull();
      expect(within(flowRegion).getByText('BEHAVIOR')).not.toBeNull();
      expect(within(flowRegion).getByText('SENTIMENT')).not.toBeNull();

      const labelAnchor = (label: string) =>
        within(flowRegion)
          .getAllByText(label)
          .find(element => element.tagName === 'text')
          ?.getAttribute('text-anchor');
      // Outcome is now the leftmost column: its labels must use first-column
      // anchoring so they don't extend past the chart's left edge.
      expect(labelAnchor('Request resolved')).toBe('start');
      // Sentiment is the last column: labels anchor to the right edge.
      expect(labelAnchor('Frustrated user')).toBe('end');
    });

    it('omits the unlinked signal from the sortable header row to match the chart', async () => {
      renderSankeySignals();

      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(columnHeaderLabels()).toEqual(['OUTCOME', 'BEHAVIOR', 'SENTIMENT']);
      expect(screen.queryByLabelText('Reorder Goal')).toBeNull();
    });
  });

  describe('when the flow request fails once', () => {
    it('retries the failed request and renders the analysis', async () => {
      let attempts = 0;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () => {
          attempts += 1;
          return attempts === 1
            ? HttpResponse.json({ error: 'Flow unavailable' }, { status: 500 })
            : HttpResponse.json(themeFlowResponse);
        }),
      );

      renderSankeySignals();

      expect(await screen.findByText('Unable to load trace signal flow.')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
      expect(attempts).toBe(2);
    });
  });

  describe('when the snapshot request fails', () => {
    it('shows the trace signal flow error state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json({ error: 'Snapshot unavailable' }, { status: 500 }),
        ),
      );

      renderSankeySignals();

      expect(await screen.findByText('Unable to load trace signal flow.')).not.toBeNull();
    });
  });

  describe('when no theme snapshot exists', () => {
    it('shows the Signals onboarding empty state with the effective catalog', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json({
            ...emptyThemeSnapshotsResponse,
            signalCatalog: [
              {
                name: 'tool_usage',
                label: 'Tool usage',
                description: 'How effectively the agent uses tools.',
                order: 0,
                builtIn: false,
                enabled: true,
                status: 'collecting',
              },
              {
                name: 'response_quality',
                label: 'Response quality',
                description: 'How useful the final answer is.',
                order: 1,
                builtIn: false,
                enabled: true,
                status: 'collecting',
              },
            ],
          }),
        ),
      );

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <SankeySignals
            entityId="support-agent"
            signalNames={['tool_usage', 'response_quality']}
            selectedThemeId={undefined}
            onSelectedThemeIdChange={() => {}}
            selectedFrameId="missing-snapshot"
            onFrameIdChange={() => {}}
          />
        </QueryClientProvider>,
      );

      expect(
        await screen.findByRole('heading', { name: 'Understand what drives every agent interaction' }),
      ).not.toBeNull();
      expect(screen.getAllByText('Tool usage')).not.toHaveLength(0);
      expect(screen.getByText('How effectively the agent uses tools.')).not.toBeNull();
      expect(screen.queryByText('Goal')).toBeNull();
    });
  });

  describe('when the flow has fewer than two populated stages', () => {
    it('shows the Signals onboarding empty state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(singleStageThemeFlowResponse),
        ),
      );

      renderSankeySignals();

      expect(
        await screen.findByRole('heading', { name: 'Understand what drives every agent interaction' }),
      ).not.toBeNull();
    });
  });

  describe('when a snapshot contains four populated trace signal stages', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(fourStageThemeFlowResponse),
        ),
      );
    });

    it('renders without the page identity header', async () => {
      renderSankeySignals();

      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(screen.queryByText('TRACE INTELLIGENCE')).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Understand what drives every agent interaction' })).toBeNull();
      expect(screen.queryByTestId('signals-page-header')).toBeNull();
      expect(screen.queryByRole('list', { name: 'Trace intelligence metrics' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Trace intelligence documentation' })).toBeNull();
    });

    it('shows the selected snapshot date, trace count, and theme count in the timeline summary', async () => {
      renderSankeySignals();

      expect(await screen.findByText('Jul 1–8, 2026 · 50 traces · 9 themes')).not.toBeNull();
      expect(screen.queryByText(/4 snapshots/)).toBeNull();
    });

    it('describes the active view under the tabs and swaps it with the tab', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(
        screen.getByText(
          "How this agent's traces distribute across goal, sentiment, behavior, and outcome themes at this point in time.",
        ),
      ).not.toBeNull();

      fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));

      expect(
        await screen.findByText('Which themes grew, shrank, appeared, or disappeared between two points in time.'),
      ).not.toBeNull();
      expect(screen.queryByText(/How this agent's traces distribute/)).toBeNull();

      fireEvent.click(screen.getByRole('tab', { name: 'Lifelines' }));

      expect(await screen.findByText("Each theme's share of traces across the whole selected range.")).not.toBeNull();
    });

    it('explains the four signals and themes when the info icon is focused', async () => {
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      const infoButton = screen.getByRole('button', { name: 'What is trace intelligence?' });
      expect(screen.queryByText('What is this?')).toBeNull();

      fireEvent.focus(infoButton);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toContain('four signals');
      expect(tooltip.textContent).toContain('named themes');
      expect(tooltip.textContent).toContain('What the user wanted from the interaction.');
      expect(tooltip.textContent).toContain('How the interaction ended.');
      expect(tooltip.textContent).toContain('the views show how they appear, grow, and fade');
      expect(tooltip.textContent).not.toContain('views above');
    });

    it('shows the selected snapshot context without controls for a single snapshot', async () => {
      renderSankeySignals();

      expect(await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces')).not.toBeNull();
      expect(screen.queryByRole('group', { name: 'Snapshot' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Play snapshots' })).toBeNull();
    });

    it('carries a theme description into the chart node label', () => {
      const { columns, records } = themeFlowToSankeyData(fourStageThemeFlowResponse);

      const record = records[0];
      const column = columns[0];
      expect(record).toBeDefined();
      expect(column).toBeDefined();
      if (!record || !column) throw new Error('Expected a trace signal flow record and column');
      expect(getSignalRecordNodeLabel(record, column)).toBe(
        'Resolve support request\nThe user wants help resolving a support issue.',
      );
    });

    it('renders one sortable column header per signal above the chart', async () => {
      renderSankeySignals();

      const chart = await screen.findByRole('region', { name: 'Trace signal theme flow' });
      const headerRow = within(chart).getByRole('group', { name: 'Trace signal column headers' });
      expect(columnHeaderLabels()).toEqual(['GOAL', 'OUTCOME', 'BEHAVIOR', 'SENTIMENT']);
      for (const label of ['Goal', 'Outcome', 'Behavior', 'Sentiment']) {
        expect(within(headerRow).getByLabelText(`Reorder ${label}`)).not.toBeNull();
      }
      // The header row replaces the SVG column labels, so headings never double up.
      expect(within(chart).getAllByText('GOAL')).toHaveLength(1);
      expect(within(chart).queryByText('RIBBON WIDTH = TRACE COUNT')).toBeNull();
      expect(within(chart).queryByText('CLICK TO ISOLATE THEME')).toBeNull();
    });

    it('describes the goal signal when its column header is focused', async () => {
      renderSankeySignals();
      const chart = await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.focus(within(chart).getByText('GOAL'));

      expect((await screen.findByRole('tooltip')).textContent).toContain('What the user wanted');
    });

    it('renders no stage legend in the chart footer', async () => {
      renderSankeySignals();

      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(screen.queryByRole('list', { name: 'Trace signal stage legend' })).toBeNull();
      expect(screen.queryByTestId('signal-legend-swatch')).toBeNull();
    });

    it('labels signals on the card border and separates themes with a horizontal rule', async () => {
      renderSankeySignals();

      const chart = await screen.findByRole('region', { name: 'Trace signal theme flow' });
      const signalHeaders = within(chart).getByRole('group', { name: 'Signals' });
      const themesRule = within(chart).getByRole('separator', { name: 'Themes' });
      expect(signalHeaders.compareDocumentPosition(themesRule) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      expect(within(chart).getByText('SIGNALS').style.writingMode).toBe('');
      expect(within(chart).getByText('THEMES').style.writingMode).toBe('');
    });

    it('renders the timeline before the flow, without a distribution rail', async () => {
      renderSankeySignals();

      const flow = await screen.findByRole('region', { name: 'Trace signal theme flow' });
      const timeline = screen.getByRole('region', { name: 'Snapshot timeline' });

      expect(timeline.compareDocumentPosition(flow) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      expect(screen.queryByRole('region', { name: 'Trace signal distributions' })).toBeNull();
      expect(screen.queryByRole('article', { name: /distribution$/ })).toBeNull();
    });

    it('does not force the analysis into a separate horizontal scroll region', async () => {
      renderSankeySignals();

      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(screen.queryByTestId('signals-analysis-scroll')).toBeNull();
      expect(screen.queryByTestId('signals-analysis-canvas')).toBeNull();
    });

    it('aligns the header centers with the Sankey edge and interior columns', async () => {
      renderSankeySignals();

      await screen.findByLabelText('Reorder Outcome');
      const draggableOffsets = screen.getAllByTestId('signal-column-header').map(header => {
        const draggable = header.closest<HTMLElement>('[data-rfd-draggable-id]');
        if (!draggable) throw new Error('Trace signal column header draggable was not rendered');
        return draggable.style.translate;
      });
      const alignmentOffsets = screen
        .getAllByTestId('signal-column-header-alignment')
        .map(header => header.style.translate);

      expect(draggableOffsets).toEqual(['', '', '', '']);
      expect(alignmentOffsets.map(Number.parseFloat)).toEqual([
        expect.closeTo(-50, 6),
        expect.closeTo(-100 / 6, 6),
        expect.closeTo(100 / 6, 6),
        expect.closeTo(50, 6),
      ]);
      expect(screen.getAllByTestId('signal-column-header-content').map(header => header.dataset.headerAnchor)).toEqual([
        'start',
        'middle',
        'middle',
        'end',
      ]);
    });

    it('places every drag handle to the right of its signal label', async () => {
      renderSankeySignals();

      const handles = await Promise.all(
        ['Goal', 'Sentiment', 'Behavior', 'Outcome'].map(label => screen.findByLabelText(`Reorder ${label}`)),
      );
      expect(handles.map(handle => getComputedStyle(handle).left)).toEqual(['100%', '100%', '100%', '100%']);
    });
  });

  describe('when a signal column header is reordered', () => {
    it('keeps the selected snapshot range on the perspective request', async () => {
      const snapshotRanges: Array<[string | null, string | null]> = [];
      const reorderedSnapshot = {
        ...themeSnapshotsResponse.snapshots[0],
        snapshotId: 'reordered-snapshot',
        availableSignals: ['goal', 'behavior', 'outcome', 'sentiment'],
      };
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          const url = new URL(request.url);
          const signalNames = url.searchParams.get('signalNames');
          snapshotRanges.push([url.searchParams.get('from'), url.searchParams.get('to')]);
          return HttpResponse.json(
            signalNames === 'goal,behavior,outcome,sentiment'
              ? { snapshots: [reorderedSnapshot] }
              : themeSnapshotsResponse,
          );
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const signalNames = new URL(request.url).searchParams.get('signalNames');
          return HttpResponse.json(
            signalNames === 'goal,behavior,outcome,sentiment'
              ? { ...reorderedFourStageThemeFlowResponse, snapshot: reorderedSnapshot }
              : fourStageThemeFlowResponse,
          );
        }),
      );
      renderSankeySignals({
        dateFrom: new Date('2026-07-01T00:00:00.000Z'),
        dateTo: new Date('2026-07-08T12:30:00.000Z'),
      });
      await screen.findByLabelText('Reorder Outcome');

      await reorderOutcomeAfterBehavior();

      await waitFor(() => expect(snapshotRanges).toHaveLength(2));
      expect(snapshotRanges).toEqual([
        ['2026-07-01T00:00:00.000Z', '2026-07-08T12:30:00.000Z'],
        ['2026-07-01T00:00:00.000Z', '2026-07-08T12:30:00.000Z'],
      ]);
    });

    it('requests the new perspective only after the column is dropped', async () => {
      const snapshotOrders: string[] = [];
      const flowOrders: string[] = [];
      const reorderedSnapshot = {
        ...themeSnapshotsResponse.snapshots[0],
        snapshotId: 'reordered-snapshot',
        availableSignals: ['goal', 'behavior', 'outcome', 'sentiment'],
      };
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          const signalNames = new URL(request.url).searchParams.get('signalNames') ?? '';
          snapshotOrders.push(signalNames);
          return HttpResponse.json(
            signalNames === 'goal,behavior,outcome,sentiment'
              ? { snapshots: [reorderedSnapshot] }
              : themeSnapshotsResponse,
          );
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const signalNames = new URL(request.url).searchParams.get('signalNames') ?? '';
          flowOrders.push(signalNames);
          const flow =
            signalNames === 'goal,behavior,outcome,sentiment'
              ? reorderedFourStageThemeFlowResponse
              : fourStageThemeFlowResponse;
          return HttpResponse.json({
            ...flow,
            snapshot:
              signalNames === 'goal,behavior,outcome,sentiment'
                ? reorderedSnapshot
                : themeSnapshotsResponse.snapshots[0],
          });
        }),
      );
      renderSankeySignals();

      await screen.findByLabelText('Reorder Outcome');
      expect(snapshotOrders).toEqual(['goal,outcome,behavior,sentiment']);
      await reorderOutcomeAfterBehavior(async () => {
        expect(snapshotOrders).toEqual(['goal,outcome,behavior,sentiment']);
        expect(flowOrders).toEqual(['goal,outcome,behavior,sentiment']);
        expect(screen.getByLabelText('Reorder Outcome').closest('[data-dragging="true"]')).not.toBeNull();
        await waitFor(() => {
          const outcomeRail = screen
            .getByLabelText('Reorder Outcome')
            .closest('[data-testid="signal-column-header-content"]')?.parentElement;
          const behaviorRail = screen
            .getByLabelText('Reorder Behavior')
            .closest('[data-testid="signal-column-header-content"]')?.parentElement;
          expect(translatePercent(outcomeRail)).toBeCloseTo(100 / 6, 6);
          expect(translatePercent(behaviorRail)).toBeCloseTo(-100 / 6, 6);
        });
      });

      await waitFor(() =>
        expect(snapshotOrders).toEqual(['goal,outcome,behavior,sentiment', 'goal,behavior,outcome,sentiment']),
      );
      await waitFor(() =>
        expect(flowOrders).toEqual(['goal,outcome,behavior,sentiment', 'goal,behavior,outcome,sentiment']),
      );
      await waitFor(() => expect(columnHeaderLabels()).toEqual(['GOAL', 'BEHAVIOR', 'OUTCOME', 'SENTIMENT']));
      const chart = within(screen.getByRole('region', { name: 'Trace signal theme flow' }));
      expect(chart.getByLabelText(/Resolve support request.*22 traces/)).not.toBeNull();
      expect(chart.getByLabelText(/Frustrated.*29 traces/)).not.toBeNull();
    });

    it('keeps the current perspective visible while the new perspective loads', async () => {
      let releaseReorderedSnapshots = () => {};
      const reorderedSnapshotsPending = new Promise<void>(resolve => {
        releaseReorderedSnapshots = resolve;
      });
      const reorderedSnapshot = {
        ...themeSnapshotsResponse.snapshots[0],
        snapshotId: 'reordered-snapshot',
        availableSignals: ['goal', 'behavior', 'outcome', 'sentiment'],
      };
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, async ({ request }) => {
          const signalNames = new URL(request.url).searchParams.get('signalNames');
          if (signalNames !== 'goal,behavior,outcome,sentiment') {
            return HttpResponse.json(themeSnapshotsResponse);
          }
          await reorderedSnapshotsPending;
          return HttpResponse.json({ snapshots: [reorderedSnapshot] });
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const signalNames = new URL(request.url).searchParams.get('signalNames');
          return HttpResponse.json(
            signalNames === 'goal,behavior,outcome,sentiment'
              ? { ...reorderedFourStageThemeFlowResponse, snapshot: reorderedSnapshot }
              : fourStageThemeFlowResponse,
          );
        }),
      );
      renderSankeySignals();
      await screen.findByLabelText('Reorder Outcome');
      const chartBeforeDrop = screen.getByTestId('sankey-order-transition');

      await reorderOutcomeAfterBehavior();

      expect(await screen.findByText('Reloading snapshots for new trace signal perspective…')).not.toBeNull();
      expect(screen.queryByTestId('signals-loading-skeleton')).toBeNull();
      // The headers stay where they were dropped while the current chart remains visible during the request.
      expect(columnHeaderLabels()).toEqual(['GOAL', 'BEHAVIOR', 'OUTCOME', 'SENTIMENT']);
      expect(screen.getByTestId('sankey-order-transition').getAttribute('aria-busy')).toBe('true');

      releaseReorderedSnapshots();
      await waitFor(() =>
        expect(screen.getByTestId('sankey-order-transition').getAttribute('aria-busy')).toBe('false'),
      );
      expect(screen.getByTestId('sankey-order-transition')).toBe(chartBeforeDrop);
    });

    it('prefetches the first landmark when the selected ordinal is absent from the new perspective', async () => {
      const reorderedFlowSnapshots: Array<string> = [];
      const unmatchedReorderedSnapshots = {
        ...landmarkThemeSnapshotsResponse,
        snapshots: landmarkThemeSnapshotsResponse.snapshots.map(snapshot => ({
          ...snapshot,
          snapshotId: `reordered-${snapshot.snapshotId}`,
          ordinal: snapshot.ordinal + 1_000,
          availableSignals: ['goal', 'behavior', 'outcome', 'sentiment'],
        })),
      };
      const sortedSnapshots = [...unmatchedReorderedSnapshots.snapshots].sort(
        (left, right) => left.ordinal - right.ordinal,
      );
      const firstSnapshot = sortedSnapshots[0];
      const secondSnapshot = sortedSnapshots[1];
      const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
      if (!firstSnapshot || !secondSnapshot || !lastSnapshot) {
        throw new Error('Expected at least four reordered snapshots');
      }
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          const signalNames = new URL(request.url).searchParams.get('signalNames');
          return HttpResponse.json(
            signalNames === 'goal,behavior,outcome,sentiment' ? unmatchedReorderedSnapshots : themeSnapshotsResponse,
          );
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const url = new URL(request.url);
          const signalNames = url.searchParams.get('signalNames')?.split(',') ?? [];
          const snapshotId = url.searchParams.get('snapshotId');
          if (!snapshotId) return HttpResponse.json({ error: 'Missing snapshot' }, { status: 400 });
          const reordered = signalNames.join(',') === 'goal,behavior,outcome,sentiment';
          const snapshots = reordered ? unmatchedReorderedSnapshots.snapshots : themeSnapshotsResponse.snapshots;
          const snapshot = snapshots.find(candidate => candidate.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          if (reordered) reorderedFlowSnapshots.push(snapshotId);
          return HttpResponse.json({ ...fourStageThemeFlowResponse, snapshot });
        }),
      );
      renderSankeySignals();
      await screen.findByLabelText('Reorder Outcome');

      await reorderOutcomeAfterBehavior();

      await waitFor(() => expect(reorderedFlowSnapshots.length).toBeGreaterThanOrEqual(3));
      expect(reorderedFlowSnapshots.slice(0, 3)).toEqual([
        firstSnapshot.snapshotId,
        secondSnapshot.snapshotId,
        lastSnapshot.snapshotId,
      ]);
    });

    it('keeps the selected snapshot ordinal when the new perspective returns opaque cursors', async () => {
      const reorderedFlowSnapshots: Array<string> = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          const signalNames = new URL(request.url).searchParams.get('signalNames');
          return HttpResponse.json(
            signalNames === 'goal,behavior,outcome,sentiment'
              ? reorderedMultiThemeSnapshotsResponse
              : multiThemeSnapshotsResponse,
          );
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const url = new URL(request.url);
          const signalNames = url.searchParams.get('signalNames')?.split(',') ?? [];
          const snapshotId = url.searchParams.get('snapshotId');
          if (!snapshotId) return HttpResponse.json({ error: 'Missing snapshot' }, { status: 400 });
          const reordered = signalNames.join(',') === 'goal,behavior,outcome,sentiment';
          const snapshots = reordered
            ? reorderedMultiThemeSnapshotsResponse.snapshots
            : multiThemeSnapshotsResponse.snapshots;
          const snapshot = snapshots.find(candidate => candidate.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          if (snapshotId.startsWith('reordered-')) reorderedFlowSnapshots.push(snapshotId);
          const sourceFlow = reordered
            ? reorderedFourStageThemeFlowResponse
            : snapshot.ordinal === 3
              ? earlierThemeFlowResponse
              : fourStageThemeFlowResponse;
          return HttpResponse.json({ ...sourceFlow, snapshot });
        }),
      );
      renderSankeySignals();
      await screen.findByLabelText('Reorder Outcome');
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 3 of 4' }));
      await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces');

      await reorderOutcomeAfterBehavior();

      expect(await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces')).not.toBeNull();
      await waitFor(() => expect(reorderedFlowSnapshots).toContain('reordered-snapshot-3'));
    });
  });

  describe('when a snapshot starts and ends on the same day', () => {
    it('shows the calendar date once', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(sameDayThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json({ ...themeFlowResponse, snapshot: sameDayThemeSnapshotsResponse.snapshots[0] }),
        ),
      );

      renderSankeySignals();

      expect(await screen.findByText('Snapshot 4/4 · Jul 15, 2026 · 50 traces')).not.toBeNull();
    });
  });

  describe('when multiple snapshots are available', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(multiThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const snapshot = multiThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          return HttpResponse.json(snapshotId === 'snapshot-3' ? earlierThemeFlowResponse : fourStageThemeFlowResponse);
        }),
      );
    });

    it('renders only the selected snapshot themes, without zero-count ghosts from other snapshots', async () => {
      renderSankeySignals();

      const chart = await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(within(chart).getByLabelText(/Legacy support request/)).not.toBeNull();
      expect(within(chart).queryByText('0 (0%)')).toBeNull();
    });

    it('places the selected snapshot summary and play control together below the landmark track', async () => {
      renderSankeySignals();

      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      const timeline = screen.getByRole('region', { name: 'Snapshot timeline' });
      const track = within(timeline).getByRole('group', { name: 'Snapshot landmarks' });
      const playButton = within(timeline).getByRole('button', { name: 'Play snapshots' });
      const summary = within(timeline).getByTestId('snapshot-summary');

      await waitFor(() =>
        expect(summary.textContent).toBe(
          snapshotSummaryLabel(multiThemeSnapshotsResponse.snapshots[0], earlierThemeFlowResponse),
        ),
      );
      expect(summary.parentElement).toBe(playButton.parentElement);
      expect(playButton.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      expect(track.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      expect(screen.queryByText(/snapshots · .*traces at this point/)).toBeNull();
    });

    it('keeps the rendered frame visible while playback advances', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, async ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          if (snapshotId === 'snapshot-3') await new Promise(resolve => window.setTimeout(resolve, 100));
          return HttpResponse.json(snapshotId === 'snapshot-3' ? earlierThemeFlowResponse : fourStageThemeFlowResponse);
        }),
      );
      renderSankeySignals();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 3 of 4' }));
      await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces');

      fireEvent.click(screen.getByRole('button', { name: 'Play snapshots' }));

      await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces', undefined, { timeout: 2000 });
      expect(screen.queryByRole('status', { name: 'Loading snapshot flow' })).toBeNull();
      expect(screen.getByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
    });

    it('selects the first available ordinal and labels it without parsing its cursor', async () => {
      renderSankeySignals();

      expect(await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces')).not.toBeNull();
      expect(screen.getByRole('group', { name: 'Snapshot landmarks' })).not.toBeNull();
    });

    it('scrubs to an earlier snapshot', async () => {
      renderSankeySignals();

      await screen.findByRole('group', { name: 'Snapshot landmarks' });
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 3 of 4' }));

      expect(await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces')).not.toBeNull();
    });

    it('reports timeline snapshot clicks through onFrameIdChange with the snapshot id', async () => {
      const onFrameIdChange = vi.fn();
      renderSankeySignals({ onFrameIdChange });

      await screen.findByRole('group', { name: 'Snapshot landmarks' });
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 4 of 4' }));

      expect(onFrameIdChange).toHaveBeenCalledWith('snapshot-1');
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 3 of 4' }));
      expect(onFrameIdChange).toHaveBeenCalledWith('snapshot-3');
    });

    it('renders the snapshot matching the controlled selectedFrameId', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <SankeySignals
            entityId="support-agent"
            signalNames={['goal', 'outcome', 'behavior', 'sentiment']}
            selectedThemeId={undefined}
            onSelectedThemeIdChange={() => {}}
            selectedFrameId="snapshot-1"
            onFrameIdChange={() => {}}
          />
        </QueryClientProvider>,
      );

      expect(await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces')).not.toBeNull();
    });

    it('reports playback advancement through onFrameIdChange', async () => {
      const onFrameIdChange = vi.fn();
      renderSankeySignals({ onFrameIdChange });
      await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces');

      fireEvent.click(screen.getByRole('button', { name: 'Play snapshots' }));

      await waitFor(() => expect(onFrameIdChange).toHaveBeenCalledWith('snapshot-1'), { timeout: 2000 });
    });

    it('stops playback at the final snapshot instead of looping', async () => {
      renderSankeySignals();
      await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces');

      fireEvent.click(screen.getByRole('button', { name: 'Play snapshots' }));

      await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces', undefined, { timeout: 2000 });
      expect(await screen.findByRole('button', { name: 'Play snapshots' }, { timeout: 2000 })).not.toBeNull();
      expect(screen.getByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces')).not.toBeNull();
    });

    it('restarts playback from the first snapshot when play is pressed at the end', async () => {
      renderSankeySignals();
      await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces');
      fireEvent.click(screen.getByRole('button', { name: 'Snapshot 4 of 4' }));
      await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces');

      fireEvent.click(screen.getByRole('button', { name: 'Play snapshots' }));

      expect(await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces')).not.toBeNull();
    });

    it('plays forward through snapshots', async () => {
      renderSankeySignals();
      await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces');

      fireEvent.click(screen.getByRole('button', { name: 'Play snapshots' }));
      expect(screen.getByRole('button', { name: 'Pause snapshots' })).not.toBeNull();

      expect(
        await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces', undefined, { timeout: 2000 }),
      ).not.toBeNull();
    });

    it('does not expose playback when a timeline flow fails to preload', async () => {
      const flowRequests: Array<string> = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          if (!snapshotId) return HttpResponse.json({ error: 'Missing snapshot' }, { status: 400 });
          flowRequests.push(snapshotId);
          if (snapshotId === 'snapshot-3') return HttpResponse.json({ error: 'Flow failed' }, { status: 500 });
          const snapshot = multiThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          return HttpResponse.json({ ...fourStageThemeFlowResponse, snapshot });
        }),
      );
      renderSankeySignals();

      expect(await screen.findByRole('button', { name: 'Retry' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Play snapshots' })).toBeNull();
      expect([...flowRequests].sort()).toEqual(['snapshot-1', 'snapshot-3']);
    });

    it('waits for every timeline flow before exposing playback', async () => {
      let releasePendingFlow: (() => void) | undefined;
      const pendingFlow = new Promise<void>(resolve => {
        releasePendingFlow = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, async ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const snapshot = multiThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (snapshotId === 'snapshot-3') await pendingFlow;
          return HttpResponse.json({ ...fourStageThemeFlowResponse, snapshot });
        }),
      );
      renderSankeySignals();

      expect(await screen.findByRole('status', { name: 'Loading trace intelligence' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Play snapshots' })).toBeNull();
      releasePendingFlow?.();
      expect(await screen.findByRole('button', { name: 'Play snapshots' })).not.toBeNull();
    });
  });

  describe('when the timeline requests snapshots', () => {
    it('requests time-balanced landmarks with a bounded limit', async () => {
      const snapshotUrls: URL[] = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          snapshotUrls.push(new URL(request.url));
          return HttpResponse.json(themeSnapshotsResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(fourStageThemeFlowResponse),
        ),
      );
      renderSankeySignals();

      await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces');
      expect(snapshotUrls[0]?.searchParams.get('presentation')).toBe('landmarks');
      expect(snapshotUrls[0]?.searchParams.get('limit')).toBe('24');
    });
  });

  describe('when the timeline holds many landmark snapshots', () => {
    it('fetches the flow only for the selected landmark and its playback neighbors', async () => {
      const flowSnapshotIds: string[] = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(landmarkThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const snapshot = landmarkThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          flowSnapshotIds.push(snapshot.snapshotId);
          return HttpResponse.json({ ...fourStageThemeFlowResponse, snapshot });
        }),
      );
      renderSankeySignals();

      const firstTick = await screen.findByRole('button', { name: /Snapshot 1 of 230/ });
      expect(firstTick.getAttribute('aria-current')).toBe('true');
      await waitFor(() =>
        expect([...new Set(flowSnapshotIds)].sort()).toEqual(['landmark-1', 'landmark-2', 'landmark-5']),
      );
      expect(flowSnapshotIds).not.toContain('landmark-3');
      expect(flowSnapshotIds).not.toContain('landmark-4');
    });

    it('places timeline ticks by snapshot cutoff time instead of even index spacing', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(landmarkThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const snapshot = landmarkThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          return HttpResponse.json({ ...fourStageThemeFlowResponse, snapshot });
        }),
      );
      renderSankeySignals();

      const track = await screen.findByRole('group', { name: 'Snapshot landmarks' });
      const ticks = within(track).getAllByRole('button');
      const positions = ticks.map(tick => Number.parseFloat(tick.style.left));

      // Range spans Jul 1 04:00 → Jul 8 00:00. Landmark 4 (Jul 7 18:00) sits in
      // the final burst, so it must land near the end rather than at 75%.
      expect(positions[0]).toBe(0);
      expect(positions[positions.length - 1]).toBe(100);
      expect(positions[3]).toBeGreaterThan(90);
    });

    it('renders the timeline above the chart with day labels where a new day starts', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(landmarkThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const snapshot = landmarkThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          return HttpResponse.json({ ...fourStageThemeFlowResponse, snapshot });
        }),
      );
      renderSankeySignals();

      const timeline = await screen.findByRole('region', { name: 'Snapshot timeline' });
      const chart = await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(timeline.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      for (const dayLabel of ['07/01', '07/02', '07/04', '07/07', '07/08']) {
        expect(within(timeline).getByText(dayLabel)).not.toBeNull();
      }
    });

    it('shows the selected summary inline with Play and updates it with the timeline', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(landmarkThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const snapshot = landmarkThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          return HttpResponse.json({ ...fourStageThemeFlowResponse, snapshot });
        }),
      );
      renderSankeySignals();

      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      const timeline = screen.getByRole('region', { name: 'Snapshot timeline' });
      const summary = within(timeline).getByTestId('snapshot-summary');
      const play = within(timeline).getByRole('button', { name: 'Play snapshots' });
      expect(summary.textContent).toContain('Jul 1, 2026, 04:00 ·');
      expect(summary.parentElement).toBe(play.parentElement);

      const nextTick = within(timeline).getByRole('button', { name: /Snapshot 117 of 230/ });
      fireEvent.click(nextTick);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Snapshot 117 of 230/ }).getAttribute('aria-current')).toBe('true'),
      );
      expect(screen.getByTestId('snapshot-summary').textContent).toContain('Jul 4, 2026, 09:00 ·');
    });
  });

  describe('when the flow reports global snapshot numbering', () => {
    it('keeps the global flow numbering out of the page and announces range-scoped numbering', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(rangeScopedThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json({
            ...fourStageThemeFlowResponse,
            snapshot: {
              ...fourStageThemeFlowResponse.snapshot,
              snapshotId: 'snapshot-range-scoped',
              ordinal: 812,
              total: 842,
            },
          }),
        ),
      );
      renderSankeySignals();

      expect(await screen.findByText('Snapshot 273/303 · Jul 1–8, 2026 · 50 traces')).not.toBeNull();
      expect(screen.queryByText(/812/)).toBeNull();
    });
  });

  describe('when API count metadata disagrees with the weighted graph', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(inconsistentTraceCountThemeFlowResponse),
        ),
      );
    });

    it('uses the charted cohort stage total in the timeline summary, not snapshot metadata', async () => {
      renderSankeySignals();

      await waitFor(() => expect(screen.getByTestId('snapshot-summary').textContent).toContain('70 traces'));
      const summary = screen.getByTestId('snapshot-summary');
      expect(summary.textContent).not.toContain('80 traces');
      expect(summary.textContent).not.toContain('50 traces');
    });

    it('shows authoritative node counts on chart nodes independently of layout weights', async () => {
      renderSankeySignals();

      const chart = await screen.findByRole('region', { name: 'Trace signal theme flow' });
      for (const label of [
        '42 (37%)',
        '38 (34%)',
        '33 (29%)',
        '51 (56%)',
        '40 (44%)',
        '54 (59%)',
        '37 (41%)',
        '49 (54%)',
        '42 (46%)',
      ]) {
        expect(within(chart).getAllByText(label).length).toBeGreaterThan(0);
      }
      expect(within(chart).queryByText('Metadata only goal')).toBeNull();
    });
  });

  describe('when themes in one trace signal stage share a display label', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(duplicateLabelThemeFlowResponse),
        ),
      );
    });

    it('renders each API node with its own trace count', async () => {
      renderSankeySignals();

      const chart = await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(within(chart).getAllByText('Shared theme label', { selector: 'text' })).toHaveLength(2);
      expect(within(chart).getByText('20 (40%)')).not.toBeNull();
      expect(within(chart).getByText('30 (60%)')).not.toBeNull();
    });
  });

  describe('when a theme snapshot has weighted links', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );
    });

    it('renders the flow with the trace signal and theme labels', async () => {
      renderSankeySignals();

      expect(await screen.findByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
    });

    it('limits the column headers to stages returned by the flow', async () => {
      renderSankeySignals();

      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(columnHeaderLabels()).toEqual(['GOAL', 'OUTCOME']);
    });

    it('retains omitted stages in the perspective after a keyboard reorder', async () => {
      const snapshotOrders: string[] = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          snapshotOrders.push(new URL(request.url).searchParams.get('signalNames') ?? '');
          return HttpResponse.json(themeSnapshotsResponse);
        }),
      );
      renderSankeySignals();
      const outcomeHandle = await screen.findByLabelText('Reorder Outcome');

      outcomeHandle.focus();
      fireEvent.keyDown(outcomeHandle, { key: ' ', code: 'Space', keyCode: 32 });
      fireEvent.keyDown(outcomeHandle, { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 });
      fireEvent.keyDown(outcomeHandle, { key: ' ', code: 'Space', keyCode: 32 });

      await waitFor(() => expect(snapshotOrders).toHaveLength(2));
      expect(snapshotOrders[1]).toBe('outcome,goal,behavior,sentiment');
    });

    it('preserves the API-defined trace signal order', () => {
      const { columns } = themeFlowToSankeyData(themeFlowResponse);

      expect(columns).toEqual([
        { id: 'goal', label: 'Goal' },
        { id: 'outcome', label: 'Outcome' },
      ]);
    });

    it('preserves the API-defined theme labels', () => {
      const { columns, records } = themeFlowToSankeyData(themeFlowResponse);
      const graph = buildSankeyChartGraph(records, columns, undefined, getSignalRecordNodeId, getSignalRecordNodeLabel);

      expect(graph.nodes.map(node => node.label)).toEqual(['Resolve support request', 'Request resolved']);
    });

    it('preserves each API link as one chart record', () => {
      const { records } = themeFlowToSankeyData(themeFlowResponse);

      expect(records).toHaveLength(1);
    });

    it('preserves the API link weight in the playground-ui chart graph', () => {
      const { columns, records } = themeFlowToSankeyData(themeFlowResponse);
      const graph = buildSankeyChartGraph(
        records,
        columns,
        record => Number(record.traceCount),
        getSignalRecordNodeId,
        getSignalRecordNodeLabel,
      );

      expect(graph.links[0]?.value).toBe(3);
    });
  });
});
