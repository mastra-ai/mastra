import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent, CardFooter } from '@mastra/playground-ui/components/Card';
import { nodeColor, Sankey, SankeyChart } from '@mastra/playground-ui/components/SankeyChart';
import type {
  SankeyChartColumn,
  SankeyChartNodeSelection,
  SankeyChartRecord,
} from '@mastra/playground-ui/components/SankeyChart';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { getSignalHue, SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ChartNoAxesGantt, Waypoints, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { fetchThemeFlow, fetchThemePaths, fetchThemeSnapshots } from './entity-learning-api';
import { useEntityLearningProgress } from './hooks/use-entity-learning-progress';
import { useSnapshotPlayback } from './hooks/use-snapshot-playback';
import { useThemeFlows } from './hooks/use-theme-flows';
import { useThemePaths } from './hooks/use-theme-paths';
import { useThemeSnapshots } from './hooks/use-theme-snapshots';
import { NoiseDetailPanel } from './noise-detail-panel';
import {
  buildSignalGraphSummary,
  getSignalRecordNodeId,
  getSignalRecordNodeLabel,
  getSignalRecordNodeValue,
  selectFlowSnapshotIds,
  snapshotSummaryLabel,
  stabilizeThemeFlow,
} from './sankey-signals-data';
import { SignalDistributions } from './signal-distributions';
import { formatSignalName } from './signal-formatting';
import { SignalsErrorState } from './signals-error-state';
import { SignalsFrameLoadingSkeleton, SignalsLoadingSkeleton } from './signals-loading-skeleton';
import { SnapshotTimeline } from './snapshot-timeline';
import { ThemeCompare } from './theme-compare';
import { ThemeDetailPanel } from './theme-detail-panel';
import { buildDrilledThemeFlow, findNoiseSelection, findThemeSelection } from './theme-drilldown-data';
import type { ThemeSelection } from './theme-drilldown-data';
import { ThemeLifelines } from './theme-lifelines';
import type { ThemeFlowResponse, TraceSignalName } from './types';
import { Link } from '@/lib/link';

export interface SankeySignalsProps {
  entityId: string;
  entityType?: string;
  signalNames: TraceSignalName[];
  dateFrom?: Date;
  dateTo?: Date;
  height?: number;
  /** Date range control rendered in line with the view mode tabs. */
  dateRangePicker?: React.ReactNode;
}

const DRILL_IN_TRACE_LIMIT = 2000;

type SignalsViewMode = 'flow' | 'compare' | 'lifelines';

function ViewModeTab({ value, icon, label }: { value: SignalsViewMode; icon: React.ReactNode; label: string }) {
  return (
    <Tab value={value} className="px-3 py-2">
      <Icon size="sm">{icon}</Icon>
      <Txt variant="ui-sm" className="text-inherit">
        {label}
      </Txt>
    </Tab>
  );
}

/**
 * Active drill-in state banner: a dismissible filter chip in the theme's
 * signal hue plus a plain-language description of the filtered subset, so the
 * chart below clearly reads as "traces flowing through this theme" rather
 * than a full snapshot.
 */
function ThemeFilterBanner({
  selection,
  filteredTraceCount,
  totalTraceCount,
  onViewDetails,
  onClear,
}: {
  selection: ThemeSelection;
  filteredTraceCount?: number;
  totalTraceCount: number;
  onViewDetails: () => void;
  onClear: () => void;
}) {
  const color = nodeColor(getSignalHue(selection.signalName));

  return (
    <section
      aria-label="Active theme drill-in"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      <button
        aria-label="Clear theme filter"
        className="border-border1 bg-surface2 text-neutral6 hover:bg-surface4 flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-2.5 text-xs font-medium transition-colors"
        onClick={onClear}
        type="button"
      >
        <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: color }} />
        {formatSignalName(selection.signalName)} · {selection.label}
        <X aria-hidden="true" className="size-3.5" />
      </button>
      <span className="text-neutral4 text-xs">
        {filteredTraceCount === undefined
          ? 'Loading theme traces…'
          : `Showing the ${filteredTraceCount} of ${totalTraceCount} traces that flow through this theme`}
      </span>
      <Button
        aria-label={`View theme details for ${selection.label}`}
        onClick={onViewDetails}
        size="sm"
        type="button"
        variant="ghost"
      >
        Details →
      </Button>
    </section>
  );
}

function FlowCard({
  columns,
  records,
  stages,
  height,
  onNodeClick,
  isNodeClickable,
  drillInDisabledReason,
}: {
  columns: SankeyChartColumn[];
  records: SankeyChartRecord[];
  stages: ThemeFlowResponse['stages'];
  height?: number;
  onNodeClick?: (selection: SankeyChartNodeSelection) => void;
  isNodeClickable?: (selection: SankeyChartNodeSelection) => boolean;
  drillInDisabledReason?: string;
}) {
  const chartColumns = columns.map(column => ({ ...column, label: column.label.toUpperCase() }));

  return (
    <Card
      aria-label="Trace signal theme flow"
      as="section"
      className="min-w-0 overflow-hidden"
      elevation="elevated"
      title={drillInDisabledReason}
    >
      <CardContent className="px-0 py-2 sm:py-3">
        <Sankey
          data={records}
          columns={chartColumns}
          columnOrder={chartColumns.map(column => column.id)}
          getColumnHue={column => getSignalHue(column.id)}
          getRecordNodeId={getSignalRecordNodeId}
          getRecordNodeLabel={getSignalRecordNodeLabel}
          getRecordNodeValue={getSignalRecordNodeValue}
          getRecordWeight={record => Number(record.traceCount)}
          getRecordLayoutWeight={record => Number(record.layoutTraceCount)}
        >
          <SankeyChart
            height={height ?? 'clamp(340px, 42vw, 460px)'}
            margin={{ top: 64, right: 32, bottom: 24, left: 32 }}
            onNodeClick={onNodeClick}
            isNodeClickable={isNodeClickable}
          />
        </Sankey>
      </CardContent>
      <CardFooter className="border-border1 bg-surface2 flex flex-wrap justify-between gap-3 border-t px-4 py-3">
        <div className="text-neutral3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] tracking-wider">
          <span>RIBBON WIDTH = TRACE COUNT</span>
          <span>CLICK TO ISOLATE THEME</span>
        </div>
        <ul
          aria-label="Trace signal stage legend"
          className="text-neutral3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
          data-alignment="right"
        >
          {stages.map(stage => (
            <li key={stage.signalName} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-[2px]"
                data-testid="signal-legend-swatch"
                style={{ backgroundColor: nodeColor(getSignalHue(stage.signalName)) }}
              />
              {formatSignalName(stage.signalName)}
            </li>
          ))}
        </ul>
      </CardFooter>
    </Card>
  );
}

/** Right-aligned control row shown when the view tabs are unavailable. */
function DateRangeRow({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end px-4 pt-4 lg:px-6 lg:pt-6">{children}</div>;
}

export function SankeySignals({
  entityId,
  entityType = 'agent',
  signalNames: initialSignalNames,
  dateFrom,
  dateTo,
  height,
  dateRangePicker,
}: SankeySignalsProps) {
  const queryClient = useQueryClient();
  const [signalNames, setSignalNames] = useState(() => initialSignalNames);
  const snapshotsQuery = useThemeSnapshots(entityId, entityType, signalNames, dateFrom, dateTo);
  const snapshots = [...(snapshotsQuery.data?.snapshots ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  const [selectedSnapshotOrdinal, setSelectedSnapshotOrdinal] = useState<number>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<SignalsViewMode>('flow');
  const [drillIn, setDrillIn] = useState<ThemeSelection>();
  const [detailSelection, setDetailSelection] = useState<ThemeSelection>();
  const [noiseSignalName, setNoiseSignalName] = useState<TraceSignalName>();
  const matchedSnapshotIndex = snapshots.findIndex(snapshot => snapshot.ordinal === selectedSnapshotOrdinal);
  const selectedSnapshotIndex = matchedSnapshotIndex >= 0 ? matchedSnapshotIndex : snapshots.length - 1;
  const snapshot = snapshots[selectedSnapshotIndex];
  const totalSnapshots = snapshotsQuery.data?.totalSnapshots ?? snapshot?.total ?? 0;
  const selectSnapshot = (index: number) => setSelectedSnapshotOrdinal(snapshots[index]?.ordinal);
  const handleViewModeChange = (nextViewMode: SignalsViewMode) => {
    if (nextViewMode !== 'flow') setIsPlaying(false);
    setViewMode(nextViewMode);
  };
  const handlePlayingChange = (nextIsPlaying: boolean) => {
    // Restart from the first landmark when play is pressed at the end.
    if (nextIsPlaying && selectedSnapshotIndex === snapshots.length - 1) selectSnapshot(0);
    setIsPlaying(nextIsPlaying);
  };
  // Compare cards and lifeline points open details for the theme at the
  // landmark they were clicked on, so the panel's snapshot follows the click.
  const openThemeDetailsAt = (selection: ThemeSelection, snapshotIndex: number) => {
    selectSnapshot(snapshotIndex);
    setNoiseSignalName(undefined);
    setDetailSelection(selection);
  };

  // Undefined at the last landmark so playback stops instead of looping.
  const nextSnapshotOrdinal = snapshots[selectedSnapshotIndex + 1]?.ordinal;
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
    drillInAvailable ? drillIn?.themeId : undefined,
  );
  const flow = useMemo(() => {
    if (!stableUnfilteredFlow || !drillIn || !pathsQuery.data) return stableUnfilteredFlow;

    const drilledFlow = buildDrilledThemeFlow(stableUnfilteredFlow, pathsQuery.data, drillIn);
    return stabilizeThemeFlow(drilledFlow, [stableUnfilteredFlow, drilledFlow]);
  }, [drillIn, pathsQuery.data, stableUnfilteredFlow]);
  const graphSummary = useMemo(() => (flow ? buildSignalGraphSummary(flow) : undefined), [flow]);
  const populatedStageCount = currentFlow?.stages.filter(stage => stage.nodes.length > 0).length ?? 0;
  const shouldLoadProgress =
    snapshotsQuery.isSuccess &&
    !snapshotsQuery.isError &&
    (!snapshot || Boolean(currentFlow && (!flow || !graphSummary || populatedStageCount < 2)));
  const progressQuery = useEntityLearningProgress(entityId, entityType, shouldLoadProgress);
  const isPlaybackBlockedByDrillIn = drillIn !== undefined && (pathsQuery.isFetching || pathsQuery.isError);
  const hasActivePathsError = drillIn !== undefined && pathsQuery.isError;

  useSnapshotPlayback({
    isPlaying,
    isPlaybackBlocked: isFlowWindowBusy || isPlaybackBlockedByDrillIn,
    nextSnapshot: nextSnapshotOrdinal,
    onAdvance: ordinal => {
      if (ordinal === undefined) {
        setIsPlaying(false);
        return;
      }
      setSelectedSnapshotOrdinal(ordinal);
    },
    snapshotCount: snapshots.length,
  });

  const perspectiveMutation = useMutation({
    mutationFn: async (nextSignalNames: TraceSignalName[]) => {
      const nextSnapshots = await queryClient.fetchQuery({
        queryKey: [
          'entity-learning',
          entityType,
          entityId,
          'theme-snapshots',
          nextSignalNames,
          dateFrom?.toISOString(),
          dateTo?.toISOString(),
        ],
        queryFn: () => fetchThemeSnapshots(entityId, entityType, nextSignalNames, dateFrom, dateTo),
      });
      const sortedNextSnapshots = [...nextSnapshots.snapshots].sort((left, right) => left.ordinal - right.ordinal);
      const matchedNextIndex = sortedNextSnapshots.findIndex(candidate => candidate.ordinal === snapshot?.ordinal);
      const nextSelectedIndex = matchedNextIndex >= 0 ? matchedNextIndex : sortedNextSnapshots.length - 1;
      const nextSnapshot = sortedNextSnapshots[nextSelectedIndex];
      await Promise.all(
        selectFlowSnapshotIds(sortedNextSnapshots, nextSelectedIndex).map(snapshotId =>
          queryClient.fetchQuery({
            queryKey: ['entity-learning', entityType, entityId, 'theme-flow', nextSignalNames, snapshotId],
            queryFn: () => fetchThemeFlow(entityId, entityType, nextSignalNames, snapshotId),
          }),
        ),
      );
      if (drillIn && nextSnapshot && nextSnapshot.traceCount <= DRILL_IN_TRACE_LIMIT) {
        await queryClient.fetchQuery({
          queryKey: ['entity-learning', entityType, entityId, 'theme-paths', nextSignalNames, nextSnapshot.snapshotId],
          queryFn: () => fetchThemePaths(entityId, entityType, nextSignalNames, nextSnapshot.snapshotId),
        });
      }
      return nextSignalNames;
    },
    onSuccess: setSignalNames,
  });

  if (snapshotsQuery.isPending) {
    return (
      <>
        {dateRangePicker && <DateRangeRow>{dateRangePicker}</DateRangeRow>}
        <SignalsLoadingSkeleton />
      </>
    );
  }

  if (snapshotsQuery.isError || hasFlowError || hasActivePathsError) {
    return (
      <>
        {dateRangePicker && <DateRangeRow>{dateRangePicker}</DateRangeRow>}
        <SignalsErrorState
          message="Unable to load trace signal flow."
          onRetry={() => {
            setIsPlaying(false);
            void snapshotsQuery.refetch();
            void Promise.all(flowQueries.map(query => query.refetch()));
            if (drillIn && drillInAvailable) void pathsQuery.refetch();
          }}
          onClear={hasActivePathsError ? () => setDrillIn(undefined) : undefined}
        />
      </>
    );
  }

  if (!snapshot) {
    return (
      <>
        {dateRangePicker && <DateRangeRow>{dateRangePicker}</DateRangeRow>}
        <SignalsEmptyState LinkComponent={Link} progress={progressQuery.data} isRangeEmpty />
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
          isPlaying={isPlaying}
          onPlayingChange={handlePlayingChange}
          onSnapshotChange={selectSnapshot}
        />
        <p className="text-neutral4 px-3 font-mono text-xs sm:px-4" data-testid="snapshot-summary">
          {snapshotSummaryLabel(snapshot, undefined)}
        </p>
        <SignalsFrameLoadingSkeleton />
      </main>
    );
  }

  if (!currentFlow || !flow || !graphSummary || populatedStageCount < 2) {
    return (
      <>
        {dateRangePicker && <DateRangeRow>{dateRangePicker}</DateRangeRow>}
        <SignalsEmptyState LinkComponent={Link} progress={progressQuery.data} />
      </>
    );
  }

  const stages = flow.stages;
  const distributionSignalNames = perspectiveMutation.isPending ? perspectiveMutation.variables : signalNames;
  const distributionPositions = new Map(distributionSignalNames.map((signalName, index) => [signalName, index]));
  const distributionStages = [...stages].sort(
    (left, right) =>
      (distributionPositions.get(left.signalName) ?? stages.length) -
      (distributionPositions.get(right.signalName) ?? stages.length),
  );
  // Noise nodes open the noise details panel (noise has no themeId, so it
  // cannot drill in) and stay clickable even when drill-in is unavailable.
  const isNodeClickable = (selection: SankeyChartNodeSelection) =>
    findNoiseSelection(flow, selection.column.id, selection.value) !== undefined ||
    (drillInAvailable && findThemeSelection(flow, selection.column.id, selection.value) !== undefined);
  const handleNodeClick = (selection: SankeyChartNodeSelection) => {
    const noiseSignal = findNoiseSelection(flow, selection.column.id, selection.value);
    if (noiseSignal) {
      setDetailSelection(undefined);
      setNoiseSignalName(noiseSignal);
      return;
    }
    if (!drillInAvailable) return;
    const nextSelection = findThemeSelection(flow, selection.column.id, selection.value);
    if (nextSelection) setDrillIn(nextSelection);
  };
  const drillInDisabledReason = drillInAvailable
    ? undefined
    : 'Drill-in is unavailable for snapshots with more than 2,000 traces.';
  const isDrilledEmpty = drillIn !== undefined && pathsQuery.data !== undefined && flow.snapshot.traceCount === 0;
  const handleSignalOrderChange = (nextSignalNames: TraceSignalName[]) => {
    if (perspectiveMutation.isPending) return;
    setIsPlaying(false);
    setDetailSelection(undefined);
    setNoiseSignalName(undefined);
    perspectiveMutation.mutate(nextSignalNames);
  };

  return (
    <main className="min-w-0 space-y-5 p-4 lg:p-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
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
        {dateRangePicker}
      </div>
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
            isPlaying={isPlaying}
            onPlayingChange={handlePlayingChange}
            onSnapshotChange={selectSnapshot}
          />
          <p className="text-neutral4 px-3 font-mono text-xs sm:px-4" data-testid="snapshot-summary">
            {drillIn ? `Filtered · ${snapshotSummaryLabel(snapshot, flow)}` : snapshotSummaryLabel(snapshot, flow)}
          </p>
          {drillIn ? (
            <ThemeFilterBanner
              selection={drillIn}
              filteredTraceCount={pathsQuery.data ? flow.stages[0]?.traceCount : undefined}
              totalTraceCount={currentFlow.stages[0]?.traceCount ?? currentFlow.snapshot.traceCount}
              onViewDetails={() => {
                setNoiseSignalName(undefined);
                setDetailSelection(drillIn);
              }}
              onClear={() => setDrillIn(undefined)}
            />
          ) : null}
          {drillIn && !drillInAvailable ? (
            <section className="border-border1 bg-surface2 text-neutral3 rounded-lg border p-6 text-sm">
              This drill-in is unavailable for snapshots with more than 2,000 traces. Use the clear filter action above
              or choose another snapshot.
            </section>
          ) : drillIn && pathsQuery.isPending ? (
            <SignalsFrameLoadingSkeleton />
          ) : isDrilledEmpty ? (
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
              columns={graphSummary.columns}
              records={graphSummary.records}
              stages={stages}
              height={height}
              onNodeClick={handleNodeClick}
              isNodeClickable={isNodeClickable}
              drillInDisabledReason={drillInDisabledReason}
            />
          )}
          {drillIn && (!drillInAvailable || pathsQuery.isPending || isDrilledEmpty) ? null : (
            <>
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
              <SignalDistributions
                disabled={perspectiveMutation.isPending}
                stages={distributionStages}
                onOrderChange={handleSignalOrderChange}
                onViewThemeDetails={selection => {
                  setNoiseSignalName(undefined);
                  setDetailSelection(selection);
                }}
                onViewNoiseDetails={signalName => {
                  setDetailSelection(undefined);
                  setNoiseSignalName(signalName);
                }}
              />
            </>
          )}
        </>
      )}
      <ThemeDetailPanel
        key={`${snapshot.snapshotId}:${detailSelection?.signalName ?? ''}:${detailSelection?.themeId ?? ''}`}
        entityId={entityId}
        entityType={entityType}
        snapshotId={snapshot.snapshotId}
        snapshotTotal={snapshot.total}
        selection={detailSelection}
        onClose={() => setDetailSelection(undefined)}
      />
      <NoiseDetailPanel
        key={`${snapshot.snapshotId}:${noiseSignalName ?? ''}`}
        entityId={entityId}
        entityType={entityType}
        snapshotId={snapshot.snapshotId}
        signalName={noiseSignalName}
        onClose={() => setNoiseSignalName(undefined)}
      />
    </main>
  );
}
