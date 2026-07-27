import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent, CardFooter } from '@mastra/playground-ui/components/Card';
import { nodeColor, Sankey, SankeyChart } from '@mastra/playground-ui/components/SankeyChart';
import type {
  SankeyChartColumn,
  SankeyChartNodeSelection,
  SankeyChartRecord,
} from '@mastra/playground-ui/components/SankeyChart';
import { getSignalHue, SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { fetchThemeFlow, fetchThemePaths, fetchThemeSnapshots } from './entity-learning-api';
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
  stabilizeThemeFlow,
} from './sankey-signals-data';
import { SignalDistributions } from './signal-distributions';
import { formatSignalName, formatSnapshotWindow, traceLabel } from './signal-formatting';
import { SignalsErrorState } from './signals-error-state';
import { SignalsFrameLoadingSkeleton, SignalsLoadingSkeleton } from './signals-loading-skeleton';
import { SnapshotTimeline } from './snapshot-timeline';
import { ThemeDetailPanel } from './theme-detail-panel';
import { buildDrilledThemeFlow, findThemeSelection } from './theme-drilldown-data';
import type { ThemeSelection } from './theme-drilldown-data';
import type { ThemeFlowResponse, TraceSignalName } from './types';
import { Link } from '@/lib/link';

export interface SankeySignalsProps {
  entityId: string;
  entityType?: string;
  signalNames: TraceSignalName[];
  height?: number;
}

const DRILL_IN_TRACE_LIMIT = 2000;

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
      aria-label="Signal theme flow"
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
          <span>HOVER OR FOCUS TO ISOLATE FLOW</span>
        </div>
        <ul
          aria-label="Signal stage legend"
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

export function SankeySignals({
  entityId,
  entityType = 'agent',
  signalNames: initialSignalNames,
  height,
}: SankeySignalsProps) {
  const queryClient = useQueryClient();
  const [signalNames, setSignalNames] = useState(() => initialSignalNames);
  const snapshotsQuery = useThemeSnapshots(entityId, entityType, signalNames);
  const snapshots = [...(snapshotsQuery.data?.snapshots ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  const [selectedSnapshotOrdinal, setSelectedSnapshotOrdinal] = useState<number>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [drillIn, setDrillIn] = useState<ThemeSelection>();
  const [detailSelection, setDetailSelection] = useState<ThemeSelection>();
  const [noiseSignalName, setNoiseSignalName] = useState<TraceSignalName>();
  const matchedSnapshotIndex = snapshots.findIndex(snapshot => snapshot.ordinal === selectedSnapshotOrdinal);
  const selectedSnapshotIndex = matchedSnapshotIndex >= 0 ? matchedSnapshotIndex : snapshots.length - 1;
  const snapshot = snapshots[selectedSnapshotIndex];
  const selectSnapshot = (index: number) => setSelectedSnapshotOrdinal(snapshots[index]?.ordinal);

  const nextSnapshotOrdinal = snapshots[(selectedSnapshotIndex + 1) % snapshots.length]?.ordinal;
  const flowQueries = useThemeFlows(
    entityId,
    entityType,
    signalNames,
    snapshots.map(candidate => candidate.snapshotId),
  );
  const flowQuery = flowQueries[selectedSnapshotIndex];
  const currentFlow = flowQuery?.data;
  const isFlowPending = flowQueries.some(query => query.isPending);
  const hasFlowError = flowQueries.some(query => query.isError);
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
  const isPlaybackBlockedByDrillIn = drillIn !== undefined && (pathsQuery.isFetching || pathsQuery.isError);
  const hasActivePathsError = drillIn !== undefined && pathsQuery.isError;

  useSnapshotPlayback({
    isPlaying,
    isPlaybackBlocked: isFlowPending || hasFlowError || isPlaybackBlockedByDrillIn,
    nextSnapshot: nextSnapshotOrdinal,
    onAdvance: setSelectedSnapshotOrdinal,
    snapshotCount: snapshots.length,
  });

  const perspectiveMutation = useMutation({
    mutationFn: async (nextSignalNames: TraceSignalName[]) => {
      const nextSnapshots = await queryClient.fetchQuery({
        queryKey: ['entity-learning', entityType, entityId, 'theme-snapshots', nextSignalNames],
        queryFn: () => fetchThemeSnapshots(entityId, entityType, nextSignalNames),
      });
      await Promise.all(
        nextSnapshots.snapshots.map(nextSnapshot =>
          queryClient.fetchQuery({
            queryKey: ['entity-learning', entityType, entityId, 'theme-flow', nextSignalNames, nextSnapshot.snapshotId],
            queryFn: () => fetchThemeFlow(entityId, entityType, nextSignalNames, nextSnapshot.snapshotId),
          }),
        ),
      );
      const nextSnapshot =
        nextSnapshots.snapshots.find(candidate => candidate.ordinal === snapshot?.ordinal) ??
        nextSnapshots.snapshots.at(-1);
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

  if (snapshotsQuery.isPending) return <SignalsLoadingSkeleton />;

  if (snapshotsQuery.isError || hasFlowError || hasActivePathsError) {
    return (
      <SignalsErrorState
        message="Unable to load signal flow."
        onRetry={() => {
          setIsPlaying(false);
          void snapshotsQuery.refetch();
          void Promise.all(flowQueries.map(query => query.refetch()));
          if (drillIn && drillInAvailable) void pathsQuery.refetch();
        }}
        onClear={hasActivePathsError ? () => setDrillIn(undefined) : undefined}
      />
    );
  }

  if (!snapshot) return <SignalsEmptyState LinkComponent={Link} />;

  if (isFlowPending) {
    return (
      <main className="min-w-0 space-y-5 p-4 lg:p-6">
        <SnapshotTimeline
          snapshots={snapshots}
          selectedIndex={selectedSnapshotIndex}
          isPlaying={isPlaying}
          onPlayingChange={setIsPlaying}
          onSnapshotChange={selectSnapshot}
        />
        <SignalsFrameLoadingSkeleton />
      </main>
    );
  }

  const populatedStageCount = currentFlow?.stages.filter(stage => stage.nodes.length > 0).length ?? 0;

  if (!currentFlow || !flow || !graphSummary || populatedStageCount < 2) {
    return <SignalsEmptyState LinkComponent={Link} />;
  }

  const stages = flow.stages;
  const distributionSignalNames = perspectiveMutation.isPending ? perspectiveMutation.variables : signalNames;
  const distributionPositions = new Map(distributionSignalNames.map((signalName, index) => [signalName, index]));
  const distributionStages = [...stages].sort(
    (left, right) =>
      (distributionPositions.get(left.signalName) ?? stages.length) -
      (distributionPositions.get(right.signalName) ?? stages.length),
  );
  const themeCount = stages.reduce(
    (total, stage) => total + stage.nodes.filter(node => node.kind === 'theme').length,
    0,
  );
  const isNodeClickable = drillInAvailable
    ? (selection: SankeyChartNodeSelection) =>
        findThemeSelection(flow, selection.column.id, selection.value) !== undefined
    : undefined;
  const handleNodeClick = drillInAvailable
    ? (selection: SankeyChartNodeSelection) => {
        const nextSelection = findThemeSelection(flow, selection.column.id, selection.value);
        if (nextSelection) setDrillIn(nextSelection);
      }
    : undefined;
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
      <header className="max-w-3xl" data-testid="signals-page-header">
        <div className="text-neutral4 flex items-center gap-2 font-mono text-xs font-semibold tracking-widest">
          <span aria-hidden="true" className="bg-accent1 size-2 rounded-full" />
          SIGNALS
        </div>
        <h1 className="text-neutral6 mt-2 text-xl font-semibold sm:text-2xl">
          Understand what drives every agent interaction
        </h1>
        <p className="text-neutral3 mt-1.5 text-sm leading-5">
          Signals group recurring patterns across traces so you can see how goals, outcomes, behaviors, and sentiment
          connect.
        </p>
        <p className="text-neutral4 mt-2 font-mono text-xs">
          {entityId} · Snapshot {flow.snapshot.ordinal} of {flow.snapshot.total} ·{' '}
          {formatSnapshotWindow(flow.snapshot.startedAt, flow.snapshot.endedAt)}
        </p>
        <ul aria-label="Signal analysis metrics" className="mt-3 flex flex-wrap gap-2">
          <li className="border-border1 bg-surface2 text-neutral4 rounded-md border px-3 py-1.5 text-xs">
            {traceLabel(flow.snapshot.traceCount)} analyzed
          </li>
          <li className="border-border1 bg-surface2 text-neutral4 rounded-md border px-3 py-1.5 text-xs">
            {themeCount} themes
          </li>
          <li className="border-border1 bg-surface2 text-neutral4 rounded-md border px-3 py-1.5 text-xs">
            {flow.stages.length} signal types
          </li>
        </ul>
      </header>
      {drillIn ? (
        <nav aria-label="Active theme drill-in" className="text-neutral4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral6 text-base font-semibold">{drillIn.label}</span>
          <Button
            aria-label={`View theme details for ${drillIn.label}`}
            onClick={() => {
              setNoiseSignalName(undefined);
              setDetailSelection(drillIn);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            View theme details
          </Button>
          <Button onClick={() => setDrillIn(undefined)} size="sm" type="button" variant="ghost">
            Clear filter
          </Button>
        </nav>
      ) : null}
      {drillIn && !drillInAvailable ? (
        <section className="border-border1 bg-surface2 text-neutral3 rounded-lg border p-6 text-sm">
          This drill-in is unavailable for snapshots with more than 2,000 traces. Use the clear filter action above or
          choose another snapshot.
        </section>
      ) : drillIn && pathsQuery.isPending ? (
        <SignalsFrameLoadingSkeleton />
      ) : isDrilledEmpty ? (
        <section className="border-border1 bg-surface2 text-neutral3 rounded-lg border p-6 text-sm">
          This theme is not present in the selected snapshot. Use the clear filter action above to return to the full
          flow.
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
      <SnapshotTimeline
        snapshots={snapshots}
        selectedIndex={selectedSnapshotIndex}
        isPlaying={isPlaying}
        onPlayingChange={setIsPlaying}
        onSnapshotChange={selectSnapshot}
      />
      {drillIn && (!drillInAvailable || pathsQuery.isPending || isDrilledEmpty) ? null : (
        <>
          {perspectiveMutation.isPending ? (
            <p className="text-neutral3 font-mono text-xs" role="status">
              Reloading snapshots for new signal perspective…
            </p>
          ) : null}
          {perspectiveMutation.isError ? (
            <p className="text-xs text-red-500" role="alert">
              Unable to load that signal perspective. Try reordering the columns again.
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
