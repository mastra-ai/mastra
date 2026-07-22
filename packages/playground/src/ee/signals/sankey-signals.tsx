import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent, CardFooter, CardHeader } from '@mastra/playground-ui/components/Card';
import { nodeColor, Sankey, SankeyChart } from '@mastra/playground-ui/components/SankeyChart';
import type {
  SankeyChartColumn,
  SankeyChartNodeSelection,
  SankeyChartRecord,
} from '@mastra/playground-ui/components/SankeyChart';
import { getSignalHue, SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';
import { useMemo, useState } from 'react';

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
import { formatSignalName, formatSnapshotWindow, traceLabel } from './signal-formatting';
import { SignalsErrorState } from './signals-error-state';
import { SignalsFrameLoadingSkeleton, SignalsLoadingSkeleton } from './signals-loading-skeleton';
import { SnapshotTimeline } from './snapshot-timeline';
import { ThemeDetailPanel } from './theme-detail-panel';
import { buildDrilledThemeFlow, findThemeSelection } from './theme-drilldown-data';
import type { ThemeSelection } from './theme-drilldown-data';
import type { ThemeFlowResponse, ThemeNode, TraceSignalName } from './types';
import { Link } from '@/lib/link';

export interface SankeySignalsProps {
  entityId: string;
  entityType?: string;
  signalNames: TraceSignalName[];
  height?: number;
}

function SignalDistributionRow({
  color,
  index,
  node,
  onViewThemeDetails,
  signalName,
}: {
  color: string;
  index: number;
  node: ThemeNode;
  onViewThemeDetails: (selection: ThemeSelection) => void;
  signalName: TraceSignalName;
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2 text-neutral5">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color, opacity: Math.max(0.35, 1 - index * 0.2) }}
        />
        <span className="truncate" title={node.label}>
          {node.label}
        </span>
      </span>
      <span className="shrink-0 font-mono text-neutral3">
        {node.traceCount} · {Math.round(node.stageShare * 100)}%
      </span>
    </>
  );

  if (node.kind === 'theme' && node.themeId && /^\d+$/.test(node.themeId)) {
    return (
      <li title={node.description ? `${node.label}\n${node.description}` : node.label}>
        <button
          aria-label={`View theme details for ${node.label}`}
          className="flex w-full min-w-0 items-center justify-between gap-3 rounded-sm text-left text-xs outline-hidden hover:bg-surface3 focus-visible:ring-1 focus-visible:ring-border2"
          onClick={() => onViewThemeDetails({ signalName, themeId: node.themeId, label: node.label })}
          type="button"
        >
          {content}
        </button>
      </li>
    );
  }

  return <li className="flex min-w-0 items-center justify-between gap-3 text-xs">{content}</li>;
}

function NoiseDistributionRow({
  color,
  signalName,
  traceCount,
  stageShare,
  onViewNoiseDetails,
}: {
  color: string;
  signalName: TraceSignalName;
  traceCount: number;
  stageShare: number;
  onViewNoiseDetails: (signalName: TraceSignalName) => void;
}) {
  const signalLabel = formatSignalName(signalName);

  return (
    <li>
      <button
        aria-label={`View Noise details for ${signalLabel}`}
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-sm text-left text-xs outline-hidden hover:bg-surface3 focus-visible:ring-1 focus-visible:ring-border2"
        onClick={() => onViewNoiseDetails(signalName)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2 text-neutral5">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: color, opacity: 0.35 }}
          />
          <span>Noise</span>
        </span>
        <span className="shrink-0 font-mono text-neutral3">
          {traceCount} · {Math.round(stageShare * 100)}%
        </span>
      </button>
    </li>
  );
}

function SignalDistribution({
  signalName,
  traceCount,
  nodes,
  onViewThemeDetails,
  onViewNoiseDetails,
}: {
  signalName: TraceSignalName;
  traceCount: number;
  nodes: ThemeNode[];
  onViewThemeDetails: (selection: ThemeSelection) => void;
  onViewNoiseDetails: (signalName: TraceSignalName) => void;
}) {
  const label = formatSignalName(signalName);
  const color = nodeColor(getSignalHue(signalName));
  const displayNodes = nodes.filter(node => node.kind !== 'noise');
  const noiseNode = nodes.find(node => node.kind === 'noise');

  return (
    <Card aria-label={`${label} distribution`} as="article" className="min-w-0" elevation="elevated">
      <CardHeader className="border-b border-border1 px-4 py-3">
        <h3 className="font-mono text-xs font-semibold tracking-wider" style={{ color }}>
          {label.toUpperCase()}
        </h3>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <p className="font-mono text-[10px] tracking-wider text-neutral3">{traceLabel(traceCount)}</p>
        <div
          aria-label={`${label} stacked distribution`}
          className="flex h-1.5 overflow-hidden rounded-sm bg-surface4"
          data-testid="distribution-stack"
        >
          {nodes.map((node, index) => (
            <span
              key={node.nodeId}
              aria-hidden="true"
              className="h-full"
              style={{
                backgroundColor: color,
                opacity: Math.max(0.35, 1 - index * 0.2),
                width: `${Math.min(node.stageShare * 100, 100)}%`,
              }}
            />
          ))}
        </div>
        <ul className="space-y-2.5">
          {displayNodes.length > 0 ? (
            displayNodes.map((node, index) => (
              <SignalDistributionRow
                key={node.nodeId}
                color={color}
                index={index}
                node={node}
                onViewThemeDetails={onViewThemeDetails}
                signalName={signalName}
              />
            ))
          ) : (
            <li className="text-xs text-neutral3">No themes detected</li>
          )}
          <NoiseDistributionRow
            color={color}
            signalName={signalName}
            traceCount={noiseNode?.traceCount ?? 0}
            stageShare={noiseNode?.stageShare ?? 0}
            onViewNoiseDetails={onViewNoiseDetails}
          />
        </ul>
      </CardContent>
    </Card>
  );
}

function SignalDistributions({
  stages,
  onViewThemeDetails,
  onViewNoiseDetails,
}: {
  stages: ThemeFlowResponse['stages'];
  onViewThemeDetails: (selection: ThemeSelection) => void;
  onViewNoiseDetails: (signalName: TraceSignalName) => void;
}) {
  return (
    <section aria-label="Signal distributions" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stages.map(stage => (
        <SignalDistribution
          key={stage.signalName}
          signalName={stage.signalName}
          traceCount={stage.traceCount}
          nodes={stage.nodes}
          onViewThemeDetails={onViewThemeDetails}
          onViewNoiseDetails={onViewNoiseDetails}
        />
      ))}
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
      <CardFooter className="flex flex-wrap justify-between gap-3 border-t border-border1 bg-surface2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] tracking-wider text-neutral3">
          <span>RIBBON WIDTH = TRACE COUNT</span>
          <span>HOVER OR FOCUS TO ISOLATE FLOW</span>
        </div>
        <ul
          aria-label="Signal stage legend"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral3"
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

export function SankeySignals({ entityId, entityType = 'agent', signalNames, height }: SankeySignalsProps) {
  const snapshotsQuery = useThemeSnapshots(entityId, entityType, signalNames);
  const snapshots = [...(snapshotsQuery.data?.snapshots ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [drillIn, setDrillIn] = useState<ThemeSelection>();
  const [detailSelection, setDetailSelection] = useState<ThemeSelection>();
  const [noiseSignalName, setNoiseSignalName] = useState<TraceSignalName>();
  const matchedSnapshotIndex = snapshots.findIndex(snapshot => snapshot.snapshotId === selectedSnapshotId);
  const selectedSnapshotIndex = matchedSnapshotIndex >= 0 ? matchedSnapshotIndex : snapshots.length - 1;
  const snapshot = snapshots[selectedSnapshotIndex];
  const selectSnapshot = (index: number) => setSelectedSnapshotId(snapshots[index]?.snapshotId);

  const nextSnapshotId = snapshots[(selectedSnapshotIndex + 1) % snapshots.length]?.snapshotId;
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
  const drillInAvailable = Boolean(currentFlow && currentFlow.snapshot.traceCount <= 2000);
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
    nextSnapshot: nextSnapshotId,
    onAdvance: setSelectedSnapshotId,
    snapshotCount: snapshots.length,
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

  return (
    <main className="min-w-0 space-y-5 p-4 lg:p-6">
      <header className="max-w-3xl" data-testid="signals-page-header">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold tracking-widest text-neutral4">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent1" />
          SIGNALS
        </div>
        <h1 className="mt-2 text-xl font-semibold text-neutral6 sm:text-2xl">
          Understand what drives every agent interaction
        </h1>
        <p className="mt-1.5 text-sm leading-5 text-neutral3">
          Signals group recurring patterns across traces so you can see how goals, outcomes, behaviors, and sentiment
          connect.
        </p>
        <p className="mt-2 font-mono text-xs text-neutral4">
          {entityId} · Snapshot {flow.snapshot.ordinal} of {flow.snapshot.total} ·{' '}
          {formatSnapshotWindow(flow.snapshot.startedAt, flow.snapshot.endedAt)}
        </p>
        <ul aria-label="Signal analysis metrics" className="mt-3 flex flex-wrap gap-2">
          <li className="rounded-md border border-border1 bg-surface2 px-3 py-1.5 text-xs text-neutral4">
            {traceLabel(flow.snapshot.traceCount)} analyzed
          </li>
          <li className="rounded-md border border-border1 bg-surface2 px-3 py-1.5 text-xs text-neutral4">
            {themeCount} themes
          </li>
          <li className="rounded-md border border-border1 bg-surface2 px-3 py-1.5 text-xs text-neutral4">
            {flow.stages.length} signal types
          </li>
        </ul>
      </header>
      {drillIn ? (
        <nav aria-label="Active theme drill-in" className="flex flex-wrap items-center gap-2 text-sm text-neutral4">
          <span className="text-base font-semibold text-neutral6">{drillIn.label}</span>
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
        <section className="rounded-lg border border-border1 bg-surface2 p-6 text-sm text-neutral3">
          This drill-in is unavailable for snapshots with more than 2,000 traces. Use the clear filter action above or
          choose another snapshot.
        </section>
      ) : drillIn && pathsQuery.isPending ? (
        <SignalsFrameLoadingSkeleton />
      ) : isDrilledEmpty ? (
        <section className="rounded-lg border border-border1 bg-surface2 p-6 text-sm text-neutral3">
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
        <SignalDistributions
          stages={stages}
          onViewThemeDetails={selection => {
            setNoiseSignalName(undefined);
            setDetailSelection(selection);
          }}
          onViewNoiseDetails={signalName => {
            setDetailSelection(undefined);
            setNoiseSignalName(signalName);
          }}
        />
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
