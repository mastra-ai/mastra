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

import { fetchThemeFlow, fetchThemePaths, fetchThemeSnapshots, serializeThemeFilters } from './entity-learning-api';
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
import {
  buildDrilledThemeFlow,
  findNoiseSelection,
  findThemeSelection,
  mergeVisibleSignalOrder,
} from './theme-drilldown-data';
import type { SelectedTheme, ThemeSelection, ThemeSelectionStats } from './theme-drilldown-data';
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

function selectionLabel(selection: ThemeSelection) {
  return `${formatSignalName(selection.signalName)} · ${selection.kind === 'theme' ? selection.label : 'Noise'}`;
}

function findSelectionStats(
  flow: ThemeFlowResponse,
  drillStack: ThemeSelection[],
  selection: ThemeSelection | undefined,
): ThemeSelectionStats | undefined {
  if (!selection) return undefined;
  if (drillStack.some(filter => filter.signalName === selection.signalName)) {
    return { traceCount: flow.snapshot.traceCount, stageShare: flow.snapshot.traceCount > 0 ? 1 : 0 };
  }

  const stage = flow.stages.find(candidate => candidate.signalName === selection.signalName);
  const node = stage?.nodes.find(candidate => {
    if (selection.kind === 'noise') return candidate.kind === 'noise';
    return candidate.kind === 'theme' && candidate.themeId === selection.themeId;
  });
  return node ? { traceCount: node.traceCount, stageShare: node.stageShare } : { traceCount: 0, stageShare: 0 };
}

function DrillFilterBanner({
  selections,
  filteredTraceCount,
  totalTraceCount,
  onViewDetails,
  onRemove,
  onClearAll,
}: {
  selections: ThemeSelection[];
  filteredTraceCount?: number;
  totalTraceCount: number;
  onViewDetails: (selection: ThemeSelection) => void;
  onRemove: (signalName: TraceSignalName) => void;
  onClearAll: () => void;
}) {
  const bannerColors = selections.map(selection => nodeColor(getSignalHue(selection.signalName)));
  const bannerColor = bannerColors[0] ?? nodeColor(getSignalHue('goal'));
  const stackedBackgroundStops = bannerColors.map(color => `color-mix(in srgb, ${color} 8%, transparent)`).join(', ');
  const stackedBorderStops = bannerColors.map(color => `color-mix(in srgb, ${color} 35%, transparent)`).join(', ');
  const backgroundImage = bannerColors.length > 1 ? `linear-gradient(90deg, ${stackedBackgroundStops})` : undefined;
  const borderBackgroundImage = bannerColors.length > 1 ? `linear-gradient(90deg, ${stackedBorderStops})` : undefined;

  return (
    <section
      aria-label="Active drill-down filters"
      className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: backgroundImage ? 'transparent' : `color-mix(in srgb, ${bannerColor} 35%, transparent)`,
        backgroundClip: backgroundImage ? 'padding-box' : undefined,
        backgroundColor: backgroundImage ? undefined : `color-mix(in srgb, ${bannerColor} 8%, transparent)`,
        backgroundImage,
      }}
    >
      {borderBackgroundImage ? (
        <span
          aria-hidden="true"
          data-testid="drill-filter-gradient-border"
          style={{
            position: 'absolute',
            inset: '-1px',
            borderRadius: 'inherit',
            padding: '1px',
            pointerEvents: 'none',
            backgroundImage: borderBackgroundImage,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      ) : null}
      {selections.map((selection, index) => {
        const label = selectionLabel(selection);
        const color = bannerColors[index];
        const isLatestSelection = index === selections.length - 1;
        return (
          <div className="flex items-center gap-1" key={selection.signalName}>
            <button
              aria-label={`Remove ${label} filter`}
              className="border-border1 bg-surface2 text-neutral6 hover:bg-surface4 flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-2.5 text-xs font-medium transition-colors"
              onClick={() => onRemove(selection.signalName)}
              type="button"
            >
              <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: color }} />
              {label}
              <X aria-hidden="true" className="size-3.5" />
            </button>
            {isLatestSelection ? (
              <Button
                aria-label={`View details for ${label}`}
                onClick={() => onViewDetails(selection)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Details →
              </Button>
            ) : null}
          </div>
        );
      })}
      <span className="text-neutral4 min-w-fit flex-1 text-xs">
        {filteredTraceCount === undefined
          ? 'Loading matching traces…'
          : `Showing ${filteredTraceCount} of ${totalTraceCount} traces that match all filters`}
      </span>
      {selections.length > 1 ? (
        <Button aria-label="Clear all filters" onClick={onClearAll} size="sm" type="button" variant="ghost">
          Clear all
        </Button>
      ) : null}
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
          key={chartColumns.map(column => column.id).join(':')}
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
  const [drillStack, setDrillStack] = useState<ThemeSelection[]>([]);
  const [detailSelection, setDetailSelection] = useState<SelectedTheme>();
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
  const openThemeDetailsAt = (selection: SelectedTheme, snapshotIndex: number) => {
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
    drillInAvailable && drillStack.length > 0,
  );
  const flow = useMemo(() => {
    if (!stableUnfilteredFlow || drillStack.length === 0 || !pathsQuery.data) return stableUnfilteredFlow;

    const drilledFlow = buildDrilledThemeFlow(stableUnfilteredFlow, pathsQuery.data, drillStack);
    return stabilizeThemeFlow(drilledFlow, [stableUnfilteredFlow, drilledFlow]);
  }, [drillStack, pathsQuery.data, stableUnfilteredFlow]);
  const graphSummary = useMemo(() => (flow ? buildSignalGraphSummary(flow) : undefined), [flow]);
  const populatedStageCount = currentFlow?.stages.filter(stage => stage.nodes.length > 0).length ?? 0;
  const shouldLoadProgress =
    snapshotsQuery.isSuccess &&
    !snapshotsQuery.isError &&
    (!snapshot || Boolean(currentFlow && (!flow || !graphSummary || populatedStageCount < 2)));
  const progressQuery = useEntityLearningProgress(entityId, entityType, shouldLoadProgress);
  const isPlaybackBlockedByDrillIn = drillStack.length > 0 && (pathsQuery.isFetching || pathsQuery.isError);
  const hasActivePathsError = drillStack.length > 0 && pathsQuery.isError;

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
      if (drillStack.length > 0 && nextSnapshot && nextSnapshot.traceCount <= DRILL_IN_TRACE_LIMIT) {
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
  const isNodeClickable = (selection: SankeyChartNodeSelection) =>
    findNoiseSelection(flow, selection.column.id, selection.value) !== undefined ||
    (drillInAvailable && findThemeSelection(flow, selection.column.id, selection.value) !== undefined);
  const openSelectionDetails = (selection: ThemeSelection) => {
    if (selection.kind === 'theme') {
      setNoiseSignalName(undefined);
      setDetailSelection(selection);
    } else {
      setDetailSelection(undefined);
      setNoiseSignalName(selection.signalName);
    }
  };
  const handleNodeClick = (chartSelection: SankeyChartNodeSelection) => {
    const selection =
      findNoiseSelection(flow, chartSelection.column.id, chartSelection.value) ??
      findThemeSelection(flow, chartSelection.column.id, chartSelection.value);
    if (!selection) return;
    if (!drillInAvailable || flow.stages.length <= 2) {
      openSelectionDetails(selection);
      return;
    }
    setDetailSelection(undefined);
    setNoiseSignalName(undefined);
    setDrillStack(current => [...current.filter(item => item.signalName !== selection.signalName), selection]);
  };
  const drillInDisabledReason = drillInAvailable
    ? undefined
    : 'Drill-in is unavailable for snapshots with more than 2,000 traces.';
  const isDrilledEmpty = drillStack.length > 0 && pathsQuery.data !== undefined && flow.snapshot.traceCount === 0;
  const handleSignalOrderChange = (nextSignalNames: TraceSignalName[]) => {
    if (perspectiveMutation.isPending) return;
    setIsPlaying(false);
    setDetailSelection(undefined);
    setNoiseSignalName(undefined);
    perspectiveMutation.mutate(mergeVisibleSignalOrder(signalNames, nextSignalNames));
  };
  const detailFilters =
    viewMode === 'flow' && detailSelection
      ? drillStack.filter(filter => filter.signalName !== detailSelection.signalName)
      : [];
  const detailStats =
    viewMode === 'flow' && drillStack.length > 0 ? findSelectionStats(flow, drillStack, detailSelection) : undefined;
  const noiseSelection: ThemeSelection | undefined = noiseSignalName
    ? { kind: 'noise', signalName: noiseSignalName }
    : undefined;
  const noiseFilters =
    viewMode === 'flow' && noiseSignalName ? drillStack.filter(filter => filter.signalName !== noiseSignalName) : [];
  const noiseStats =
    viewMode === 'flow' && drillStack.length > 0 ? findSelectionStats(flow, drillStack, noiseSelection) : undefined;
  const detailFilterKey = serializeThemeFilters(detailFilters);
  const noiseFilterKey = serializeThemeFilters(noiseFilters);

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
            {drillStack.length > 0
              ? `Filtered · ${snapshotSummaryLabel(snapshot, flow)}`
              : snapshotSummaryLabel(snapshot, flow)}
          </p>
          {drillStack.length > 0 ? (
            <DrillFilterBanner
              selections={drillStack}
              filteredTraceCount={pathsQuery.data ? flow.snapshot.traceCount : undefined}
              totalTraceCount={currentFlow.snapshot.traceCount}
              onViewDetails={openSelectionDetails}
              onRemove={signalName => setDrillStack(current => current.filter(item => item.signalName !== signalName))}
              onClearAll={() => setDrillStack([])}
            />
          ) : null}
          {drillStack.length > 0 && !drillInAvailable ? (
            <section className="border-border1 bg-surface2 text-neutral3 rounded-lg border p-6 text-sm">
              These filters are unavailable for snapshots with more than 2,000 traces. Clear the filters above or choose
              another snapshot.
            </section>
          ) : drillStack.length > 0 && pathsQuery.isPending ? (
            <SignalsFrameLoadingSkeleton />
          ) : isDrilledEmpty ? (
            <section className="border-border1 bg-surface2 text-neutral3 rounded-lg border p-6 text-sm">
              These filters have no matching traces in the selected snapshot. Clear a filter above to return to the
              flow.
            </section>
          ) : drillStack.length > 0 && flow.stages.length < 2 ? (
            <section
              aria-label="Filtered trace summary"
              className="border-border1 bg-surface2 text-neutral3 rounded-lg border p-6 text-sm"
            >
              <p className="text-neutral5 font-medium">
                {flow.stages.length} signal {flow.stages.length === 1 ? 'column remains' : 'columns remain'} after
                applying these filters.
              </p>
              <p className="mt-1">
                {flow.snapshot.traceCount} matching {flow.snapshot.traceCount === 1 ? 'trace' : 'traces'}. Remove a
                filter to compare flow across more signals.
              </p>
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
          {drillStack.length > 0 && (!drillInAvailable || pathsQuery.isPending || isDrilledEmpty) ? null : (
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
        key={`${snapshot.snapshotId}:${detailSelection?.signalName ?? ''}:${detailSelection?.themeId ?? ''}:${detailFilterKey}`}
        entityId={entityId}
        entityType={entityType}
        snapshotId={snapshot.snapshotId}
        snapshotTotal={snapshot.total}
        selection={detailSelection}
        filters={detailFilters}
        filteredStats={detailStats}
        onClose={() => setDetailSelection(undefined)}
      />
      <NoiseDetailPanel
        key={`${snapshot.snapshotId}:${noiseSignalName ?? ''}:${noiseFilterKey}`}
        entityId={entityId}
        entityType={entityType}
        snapshotId={snapshot.snapshotId}
        signalName={noiseSignalName}
        filters={noiseFilters}
        filteredStats={noiseStats}
        onClose={() => setNoiseSignalName(undefined)}
      />
    </main>
  );
}
