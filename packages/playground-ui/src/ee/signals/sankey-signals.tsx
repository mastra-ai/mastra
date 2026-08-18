import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ChartNoAxesGantt, Waypoints } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PendingSignalProgress } from './components/signals-empty-state';
import { SignalsOverviewPage as SignalsEmptyState } from './components/signals-overview-page';
import { fetchThemeFlow, fetchThemePaths, fetchThemeSnapshots, serializeThemeFilters } from './entity-learning-api';
import { FlowCard } from './flow-card';
import { useEntityLearningProgress } from './hooks/use-entity-learning-progress';
import { useSnapshotPlayback } from './hooks/use-snapshot-playback';
import { useThemeFlows } from './hooks/use-theme-flows';
import { useThemePaths } from './hooks/use-theme-paths';
import { useThemeSnapshots } from './hooks/use-theme-snapshots';
import { NoiseDetailPanel } from './noise-detail-panel';
import {
  buildSignalGraphSummary,
  selectFlowSnapshotIds,
  snapshotSummaryLabel,
  stabilizeThemeFlow,
} from './sankey-signals-data';
import { orderedSignals, signalLabel } from './signal-formatting';
import { SignalsErrorState } from './signals-error-state';
import { SignalsFrameLoadingSkeleton, SignalsLoadingSkeleton } from './signals-loading-skeleton';
import { SnapshotTimeline } from './snapshot-timeline';
import { ThemeCompare } from './theme-compare';
import { ThemeDetailPanel } from './theme-detail-panel';
import {
  buildDrilledThemeFlow,
  findNoiseSelection,
  findSelectionStats,
  findThemeSelection,
  findThemeSelectionById,
  mergeVisibleSignalOrder,
} from './theme-drilldown-data';
import type { SelectedTheme, ThemeSelection } from './theme-drilldown-data';
import { ThemeFilterBanner } from './theme-filter-banner';
import { ThemeLifelines } from './theme-lifelines';
import { TraceIntelligenceExplainer } from './trace-intelligence-explainer';
import type { ThemeFlowResponse, TraceSignalName } from './types';
import { useTraceIntelligence } from './use-trace-intelligence';
import { ViewModeTab } from './view-mode-tab';
import type { SignalsViewMode } from './view-mode-tab';
import type { SankeyChartNodeSelection } from '@/ds/components/SankeyChart';
import { TabList, Tabs } from '@/ds/components/Tabs';

export interface SankeySignalsProps {
  entityId: string;
  entityType?: string;
  signalNames: TraceSignalName[];
  dateFrom?: Date;
  dateTo?: Date;
  height?: number;
  selectedThemeId: string | undefined;
  onSelectedThemeIdChange: (themeId: string | undefined) => void;
  /** Snapshot id of the timeline frame currently displayed. The parent owns this state. */
  selectedFrameId: string;
  onFrameIdChange: (frameId: string) => void;
  /** Date range control rendered in line with the view mode tabs. */
  dateRangePicker?: React.ReactNode;
}

const DRILL_IN_TRACE_LIMIT = 2000;

/** One-line answer to "what am I looking at?" for each view, shown under the tabs. */
const VIEW_DESCRIPTIONS: Omit<Record<SignalsViewMode, string>, 'flow'> = {
  compare: 'Which themes grew, shrank, appeared, or disappeared between two points in time.',
  lifelines: "Each theme's share of traces across the whole selected range.",
};

function formatSignalList(labels: string[]): string {
  if (labels.length < 2) return labels[0] ?? 'trace signal';
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
}

export function SankeySignals({
  entityId,
  entityType = 'agent',
  signalNames: initialSignalNames,
  dateFrom,
  dateTo,
  height,
  selectedThemeId,
  onSelectedThemeIdChange,
  selectedFrameId,
  onFrameIdChange,
  dateRangePicker,
}: SankeySignalsProps) {
  const queryClient = useQueryClient();
  const { cacheScope, request, LinkComponent, signalCatalog } = useTraceIntelligence();
  const [signalNames, setSignalNames] = useState(() => initialSignalNames);
  const [pendingSignalNames, setPendingSignalNames] = useState<TraceSignalName[]>();
  const snapshotsQuery = useThemeSnapshots(entityId, entityType, signalNames, dateFrom, dateTo);
  const effectiveSignalCatalog = snapshotsQuery.data?.signalCatalog ?? signalCatalog;
  const snapshots = [...(snapshotsQuery.data?.snapshots ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<SignalsViewMode>('flow');
  const [drillStack, setDrillStack] = useState<ThemeSelection[]>([]);
  const [noiseSignalName, setNoiseSignalName] = useState<TraceSignalName>();
  // Pure derivation: the parent owns the frame. The index-0 fallback only covers
  // the transient render where a perspective change swapped the snapshot list.
  const matchedSnapshotIndex = snapshots.findIndex(snapshot => snapshot.snapshotId === selectedFrameId);
  const selectedSnapshotIndex = matchedSnapshotIndex >= 0 ? matchedSnapshotIndex : 0;
  const snapshot = snapshots[selectedSnapshotIndex];
  const totalSnapshots = snapshotsQuery.data?.totalSnapshots ?? snapshot?.total ?? 0;
  const selectSnapshot = (index: number) => {
    const id = snapshots[index]?.snapshotId;
    if (id) onFrameIdChange(id);
  };
  const handleViewModeChange = (nextViewMode: SignalsViewMode) => {
    if (nextViewMode !== 'flow') setIsPlaying(false);
    setViewMode(nextViewMode);
  };
  const handlePlayingChange = (nextIsPlaying: boolean) => {
    // Restart from the first landmark when play is pressed at the end.
    if (nextIsPlaying && selectedSnapshotIndex === snapshots.length - 1) selectSnapshot(0);
    setIsPlaying(nextIsPlaying);
  };
  const setThemeDetails = (selection: SelectedTheme | undefined) => {
    onSelectedThemeIdChange(selection?.themeId);
  };
  // Compare cards and lifeline points open details for the theme at the
  // landmark they were clicked on, so the panel's snapshot follows the click.
  const openThemeDetailsAt = (selection: ThemeSelection, snapshotIndex: number) => {
    if (selection.kind !== 'theme') return;
    selectSnapshot(snapshotIndex);
    setNoiseSignalName(undefined);
    setThemeDetails(selection);
  };

  // Undefined at the last landmark so playback stops instead of looping.
  const nextSnapshotId = snapshots[selectedSnapshotIndex + 1]?.snapshotId;
  const flowSnapshotIds = selectFlowSnapshotIds(snapshots, selectedSnapshotIndex);
  const flowQueries = useThemeFlows(entityId, entityType, signalNames, flowSnapshotIds);
  const flowQuery = flowQueries[flowSnapshotIds.indexOf(snapshot?.snapshotId ?? '')];
  const currentFlow = flowQuery?.data;
  // The loading skeleton tracks only the selected snapshot's flow; prefetched
  // neighbors warm the cache in the background without blocking the chart.
  const isFlowPending = flowQuery?.isPending ?? false;
  // Errors stay window-wide: a failed preload surfaces the retry state instead
  // of letting playback advance into a broken frame.
  const hasFlowError = flowQueries.some(query => query.isError);
  const isFlowWindowBusy = flowQueries.some(query => query.isPending) || hasFlowError;
  const windowFlows = useMemo(() => flowQueries.flatMap(query => (query.data ? [query.data] : [])), [flowQueries]);
  const stableUnfilteredFlow = useMemo(
    () => (currentFlow ? stabilizeThemeFlow(currentFlow, windowFlows) : undefined),
    [currentFlow, windowFlows],
  );
  const drillInAvailable = Boolean(currentFlow && currentFlow.snapshot.traceCount <= DRILL_IN_TRACE_LIMIT);
  const pathsQuery = useThemePaths(
    entityId,
    entityType,
    signalNames,
    snapshot?.snapshotId,
    drillInAvailable && drillStack.length > 0,
  );
  const flow = useMemo(() => {
    if (!stableUnfilteredFlow || drillStack.length === 0 || !pathsQuery.data) return stableUnfilteredFlow;

    const drilledFlow = buildDrilledThemeFlow(stableUnfilteredFlow, pathsQuery.data, drillStack);
    return stabilizeThemeFlow(drilledFlow, [stableUnfilteredFlow, drilledFlow]);
  }, [drillStack, pathsQuery.data, stableUnfilteredFlow]);
  const graphSummary = useMemo(() => (flow ? buildSignalGraphSummary(flow) : undefined), [flow]);
  const detailSelection =
    stableUnfilteredFlow && selectedThemeId ? findThemeSelectionById(stableUnfilteredFlow, selectedThemeId) : undefined;
  const populatedStageCount = currentFlow?.stages.filter(stage => stage.nodes.length > 0).length ?? 0;
  const hasPendingEnabledSignals = effectiveSignalCatalog.some(signal => signal.enabled && signal.status !== 'ready');
  const shouldLoadProgress =
    snapshotsQuery.isSuccess &&
    !snapshotsQuery.isError &&
    (hasPendingEnabledSignals ||
      !snapshot ||
      Boolean(currentFlow && (!flow || !graphSummary || populatedStageCount < 2)));
  const progressQuery = useEntityLearningProgress(entityId, entityType, shouldLoadProgress);
  const isPlaybackBlockedByDrillIn = drillStack.length > 0 && (pathsQuery.isFetching || pathsQuery.isError);
  const hasActivePathsError = drillStack.length > 0 && pathsQuery.isError;

  useSnapshotPlayback({
    isPlaying,
    isPlaybackBlocked: isFlowWindowBusy || isPlaybackBlockedByDrillIn,
    nextSnapshot: nextSnapshotId,
    onAdvance: frameId => {
      if (frameId === undefined) {
        setIsPlaying(false);
        return;
      }
      onFrameIdChange(frameId);
    },
    snapshotCount: snapshots.length,
  });

  const perspectiveMutation = useMutation({
    mutationFn: async (nextSignalNames: TraceSignalName[]) => {
      const nextSnapshots = await queryClient.fetchQuery({
        queryKey: [
          'entity-learning',
          cacheScope,
          entityType,
          entityId,
          'theme-snapshots',
          nextSignalNames,
          dateFrom?.toISOString(),
          dateTo?.toISOString(),
        ],
        queryFn: () => fetchThemeSnapshots(request, entityId, entityType, nextSignalNames, dateFrom, dateTo),
      });
      const sortedNextSnapshots = [...nextSnapshots.snapshots].sort((left, right) => left.ordinal - right.ordinal);
      const matchedNextIndex = sortedNextSnapshots.findIndex(candidate => candidate.ordinal === snapshot?.ordinal);
      const nextSelectedIndex = matchedNextIndex >= 0 ? matchedNextIndex : 0;
      const nextSnapshot = sortedNextSnapshots[nextSelectedIndex];
      await Promise.all(
        selectFlowSnapshotIds(sortedNextSnapshots, nextSelectedIndex).map(snapshotId =>
          queryClient.fetchQuery({
            queryKey: ['entity-learning', cacheScope, entityType, entityId, 'theme-flow', nextSignalNames, snapshotId],
            queryFn: () => fetchThemeFlow(request, entityId, entityType, nextSignalNames, snapshotId),
          }),
        ),
      );
      if (drillStack.length > 0 && nextSnapshot && nextSnapshot.traceCount <= DRILL_IN_TRACE_LIMIT) {
        await queryClient.fetchQuery({
          queryKey: [
            'entity-learning',
            cacheScope,
            entityType,
            entityId,
            'theme-paths',
            nextSignalNames,
            nextSnapshot.snapshotId,
          ],
          queryFn: () => fetchThemePaths(request, entityId, entityType, nextSignalNames, nextSnapshot.snapshotId),
        });
      }
      return { nextSignalNames, nextFrameId: nextSnapshot?.snapshotId };
    },
    onSuccess: ({ nextSignalNames, nextFrameId }) => {
      setSignalNames(nextSignalNames);
      setPendingSignalNames(undefined);
      // Keep the parent-owned frame pointing at a snapshot that exists in the new perspective.
      if (nextFrameId && nextFrameId !== selectedFrameId) onFrameIdChange(nextFrameId);
    },
    onError: () => setPendingSignalNames(undefined),
  });

  if (snapshotsQuery.isPending) {
    return (
      <>
        {dateRangePicker && <div className="flex justify-end px-4 pt-4 lg:px-6 lg:pt-6">{dateRangePicker}</div>}
        <SignalsLoadingSkeleton />
      </>
    );
  }

  if (snapshotsQuery.isError || hasFlowError || hasActivePathsError) {
    return (
      <>
        {dateRangePicker && <div className="flex justify-end px-4 pt-4 lg:px-6 lg:pt-6">{dateRangePicker}</div>}
        <SignalsErrorState
          message="Unable to load trace signal flow."
          onRetry={() => {
            setIsPlaying(false);
            void snapshotsQuery.refetch();
            void Promise.all(flowQueries.map(query => query.refetch()));
            if (drillStack.length > 0 && drillInAvailable) void pathsQuery.refetch();
          }}
          onClear={hasActivePathsError ? () => setDrillStack([]) : undefined}
        />
      </>
    );
  }

  if (!snapshot) {
    return (
      <>
        {dateRangePicker && <div className="flex justify-end px-4 pt-4 lg:px-6 lg:pt-6">{dateRangePicker}</div>}
        <SignalsEmptyState LinkComponent={LinkComponent} progress={progressQuery.data} isRangeEmpty />
      </>
    );
  }

  if (isFlowPending) {
    return (
      <main className="min-w-0 space-y-5 p-4 lg:p-6">
        {dateRangePicker && <div className="flex justify-end">{dateRangePicker}</div>}
        <SnapshotTimeline
          snapshots={snapshots}
          selectedIndex={selectedSnapshotIndex}
          totalSnapshots={totalSnapshots}
          summary={snapshot ? snapshotSummaryLabel(snapshot, undefined) : ''}
          isPlaying={isPlaying}
          onPlayingChange={handlePlayingChange}
          onSnapshotChange={selectSnapshot}
        />
        <SignalsFrameLoadingSkeleton />
      </main>
    );
  }

  if (!currentFlow || !flow || !graphSummary || populatedStageCount < 2) {
    return (
      <>
        {dateRangePicker && <div className="flex justify-end px-4 pt-4 lg:px-6 lg:pt-6">{dateRangePicker}</div>}
        <SignalsEmptyState LinkComponent={LinkComponent} progress={progressQuery.data} />
      </>
    );
  }

  const stages = flow.stages;
  const isNodeClickable = (selection: SankeyChartNodeSelection) =>
    findNoiseSelection(flow, selection.column.id, selection.value) !== undefined ||
    findThemeSelection(flow, selection.column.id, selection.value) !== undefined;
  const handleNodeClick = (selection: SankeyChartNodeSelection) => {
    const nextSelection =
      findNoiseSelection(flow, selection.column.id, selection.value) ??
      findThemeSelection(flow, selection.column.id, selection.value);
    if (!nextSelection || drillStack.some(filter => filter.signalName === nextSelection.signalName)) return;
    if (nextSelection.kind === 'theme') {
      setNoiseSignalName(undefined);
      setThemeDetails(nextSelection);
      if (drillInAvailable) setDrillStack(current => [...current, nextSelection]);
    } else {
      setThemeDetails(undefined);
      setNoiseSignalName(nextSelection.signalName);
    }
  };
  const drillInDisabledReason = drillInAvailable
    ? undefined
    : 'Drill-in is unavailable for snapshots with more than 2,000 traces.';
  const isDrilledEmpty = drillStack.length > 0 && pathsQuery.data !== undefined && flow.snapshot.traceCount === 0;
  const handleSignalOrderChange = (nextSignalNames: TraceSignalName[]) => {
    if (perspectiveMutation.isPending) return;
    setIsPlaying(false);
    setThemeDetails(undefined);
    setNoiseSignalName(undefined);
    const mergedSignalNames = mergeVisibleSignalOrder(signalNames, nextSignalNames);
    setPendingSignalNames(mergedSignalNames);
    perspectiveMutation.mutate(mergedSignalNames);
  };
  const filtersResolved = drillStack.length > 0 && drillInAvailable && pathsQuery.data !== undefined;
  const detailStats = filtersResolved ? findSelectionStats(flow, drillStack, detailSelection) : undefined;
  const noiseStats = filtersResolved
    ? findSelectionStats(flow, drillStack, noiseSignalName ? { kind: 'noise', signalName: noiseSignalName } : undefined)
    : undefined;
  const filterKey = serializeThemeFilters(drillStack);
  const catalogSignalNames = orderedSignals(
    effectiveSignalCatalog,
    effectiveSignalCatalog.filter(signal => signal.enabled).map(signal => signal.name),
  );
  const viewDescription =
    viewMode === 'flow'
      ? `How this agent's traces distribute across ${formatSignalList(catalogSignalNames.map(name => signalLabel(effectiveSignalCatalog, name).toLocaleLowerCase()))} themes at this point in time.`
      : VIEW_DESCRIPTIONS[viewMode];
  const labeledColumns = graphSummary.columns.map(column => ({
    ...column,
    label: signalLabel(effectiveSignalCatalog, column.id),
  }));

  return (
    <main className="min-w-0 space-y-5 p-4 lg:p-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <Tabs<SignalsViewMode>
            value={viewMode}
            defaultTab="flow"
            onValueChange={handleViewModeChange}
            className="w-fit"
          >
            <TabList variant="pill-ghost">
              <ViewModeTab value="flow" icon={<Waypoints />} label="Flow" />
              <ViewModeTab value="compare" icon={<ArrowLeftRight />} label="Compare" />
              <ViewModeTab value="lifelines" icon={<ChartNoAxesGantt />} label="Lifelines" />
            </TabList>
          </Tabs>
          <TraceIntelligenceExplainer signalCatalog={effectiveSignalCatalog} />
        </div>
        {dateRangePicker}
      </div>
      <p className="text-neutral3 text-xs">{viewDescription}</p>
      <PendingSignalProgress progress={progressQuery.data} signalCatalog={effectiveSignalCatalog} />
      {viewMode === 'compare' ? (
        <ThemeCompare
          entityId={entityId}
          entityType={entityType}
          signalNames={signalNames}
          snapshots={snapshots}
          totalSnapshots={totalSnapshots}
          onThemeSelect={openThemeDetailsAt}
        />
      ) : viewMode === 'lifelines' ? (
        <ThemeLifelines
          entityId={entityId}
          entityType={entityType}
          signalNames={signalNames}
          snapshots={snapshots}
          totalSnapshots={totalSnapshots}
          selectedIndex={selectedSnapshotIndex}
          onSnapshotSelect={selectSnapshot}
          onThemeSelect={openThemeDetailsAt}
        />
      ) : (
        <>
          <SnapshotTimeline
            snapshots={snapshots}
            selectedIndex={selectedSnapshotIndex}
            totalSnapshots={totalSnapshots}
            summary={`${drillStack.length > 0 ? (drillInAvailable ? 'Filtered · ' : 'Filters unavailable · ') : ''}${snapshotSummaryLabel(snapshot, flow)}`}
            isPlaying={isPlaying}
            onPlayingChange={handlePlayingChange}
            onSnapshotChange={selectSnapshot}
          />
          {drillStack.length > 0 ? (
            <ThemeFilterBanner
              selections={drillStack}
              filteredTraceCount={filtersResolved ? flow.snapshot.traceCount : undefined}
              totalTraceCount={currentFlow.snapshot.traceCount}
              isUnavailable={!drillInAvailable}
              onViewDetails={selection => {
                if (selection.kind === 'theme') {
                  setNoiseSignalName(undefined);
                  setThemeDetails(selection);
                } else {
                  setThemeDetails(undefined);
                  setNoiseSignalName(selection.signalName);
                }
              }}
              onRemove={signalName =>
                setDrillStack(current => current.filter(filter => filter.signalName !== signalName))
              }
              onClear={() => setDrillStack([])}
            />
          ) : null}
          {isDrilledEmpty ? (
            <section className="border-border1 bg-surface2 text-neutral3 rounded-lg border p-6 text-sm">
              This theme is not present in the selected snapshot. Use the clear filter action above to return to the
              full flow.
            </section>
          ) : graphSummary.records.length === 0 ? (
            <section className="border-border1 bg-surface2 text-neutral3 rounded-lg border p-6 text-sm">
              No cross-signal flow for this snapshot — its trace signals have not overlapped on shared traces yet. Pick
              another snapshot from the timeline below.
            </section>
          ) : (
            <FlowCard
              columns={labeledColumns}
              records={graphSummary.records}
              stages={stages}
              height={height}
              onNodeClick={handleNodeClick}
              isNodeClickable={isNodeClickable}
              drillInDisabledReason={drillInDisabledReason}
              onOrderChange={handleSignalOrderChange}
              signalOrder={pendingSignalNames ?? signalNames}
              reorderDisabled={perspectiveMutation.isPending}
            />
          )}
          {perspectiveMutation.isPending ? (
            <p className="text-neutral3 font-mono text-xs" role="status">
              Reloading snapshots for new trace signal perspective…
            </p>
          ) : null}
          {perspectiveMutation.isError ? (
            <p className="text-xs text-red-500" role="alert">
              Unable to load that trace signal perspective. Try reordering the columns again.
            </p>
          ) : null}
        </>
      )}
      <ThemeDetailPanel
        key={`${snapshot.snapshotId}:${detailSelection?.signalName ?? ''}:${detailSelection?.themeId ?? ''}:${filterKey}`}
        entityId={entityId}
        entityType={entityType}
        snapshotId={snapshot.snapshotId}
        snapshotTotal={snapshot.total}
        selection={detailSelection}
        filters={drillStack}
        filteredStats={detailStats}
        onClose={() => setThemeDetails(undefined)}
      />
      <NoiseDetailPanel
        key={`${snapshot.snapshotId}:${noiseSignalName ?? ''}:${filterKey}`}
        entityId={entityId}
        entityType={entityType}
        snapshotId={snapshot.snapshotId}
        signalName={noiseSignalName}
        filters={drillStack}
        filteredStats={noiseStats}
        onClose={() => setNoiseSignalName(undefined)}
      />
    </main>
  );
}
