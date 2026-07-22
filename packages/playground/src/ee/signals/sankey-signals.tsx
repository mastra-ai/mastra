import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent, CardFooter, CardHeader } from '@mastra/playground-ui/components/Card';
import { nodeColor, Sankey, SankeyChart } from '@mastra/playground-ui/components/SankeyChart';
import type { SankeyChartColumn, SankeyChartRecord } from '@mastra/playground-ui/components/SankeyChart';
import { Slider } from '@mastra/playground-ui/components/Slider';
import { getSignalHue, SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';
import { Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useThemeFlows } from './hooks/use-theme-flows';
import { useThemeSnapshots } from './hooks/use-theme-snapshots';
import {
  buildSignalGraphSummary,
  getSignalRecordNodeId,
  getSignalRecordNodeLabel,
  getSignalRecordNodeValue,
  stabilizeThemeFlow,
} from './sankey-signals-data';
import { SignalsErrorState } from './signals-error-state';
import { SignalsLoadingSkeleton } from './signals-loading-skeleton';
import type { ThemeFlowResponse, ThemeNode, ThemeSnapshot, TraceSignalName } from './types';
import { Link } from '@/lib/link';

export interface SankeySignalsProps {
  entityId: string;
  entityType?: string;
  signalNames: TraceSignalName[];
  height?: number;
}

function formatSignalName(signalName: TraceSignalName) {
  return signalName.charAt(0).toUpperCase() + signalName.slice(1);
}

function traceLabel(count: number) {
  return `${count} ${count === 1 ? 'trace' : 'traces'}`;
}

function formatSnapshotWindow(startedAt: string, endedAt: string) {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });
  const year = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' });
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const sameDay = sameMonth && start.getUTCDate() === end.getUTCDate();

  if (sameDay) return `${monthDay.format(start)}, ${year.format(start)}`;
  if (sameMonth) return `${monthDay.format(start)}–${day.format(end)}, ${year.format(end)}`;
  if (sameYear) return `${monthDay.format(start)}–${monthDay.format(end)}, ${year.format(end)}`;
  return `${monthDay.format(start)}, ${year.format(start)}–${monthDay.format(end)}, ${year.format(end)}`;
}

function SnapshotTimeline({
  snapshots,
  selectedIndex,
  isPlaying,
  onPlayingChange,
  onSnapshotChange,
}: {
  snapshots: ThemeSnapshot[];
  selectedIndex: number;
  isPlaying: boolean;
  onPlayingChange: (isPlaying: boolean) => void;
  onSnapshotChange: (index: number) => void;
}) {
  const snapshot = snapshots[selectedIndex];

  if (!snapshot) return null;

  return (
    <section
      aria-label="Snapshot timeline"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border1 bg-surface2 px-3 py-2.5 sm:px-4"
    >
      {snapshots.length > 1 ? (
        <>
          <Button
            aria-label={isPlaying ? 'Pause snapshots' : 'Play snapshots'}
            onClick={() => onPlayingChange(!isPlaying)}
            size="sm"
            type="button"
            variant="outline"
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Slider
            aria-label="Snapshot"
            className="min-w-32 flex-1"
            max={snapshots.length - 1}
            min={0}
            onValueChange={value => onSnapshotChange(value[0] ?? 0)}
            step={1}
            value={[selectedIndex]}
          />
        </>
      ) : null}
      <p
        aria-live="polite"
        className="w-full text-left font-mono text-xs tabular-nums text-neutral4 md:ml-auto md:w-auto md:min-w-72 md:text-right"
      >
        Snapshot {snapshot.ordinal}/{snapshot.total} · {formatSnapshotWindow(snapshot.startedAt, snapshot.endedAt)} ·{' '}
        {traceLabel(snapshot.traceCount)}
      </p>
    </section>
  );
}

function SignalDistribution({
  signalName,
  traceCount,
  nodes,
}: {
  signalName: TraceSignalName;
  traceCount: number;
  nodes: ThemeNode[];
}) {
  const label = formatSignalName(signalName);
  const color = nodeColor(getSignalHue(signalName));

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
          {nodes.length > 0 ? (
            nodes.map((node, index) => (
              <li
                key={node.nodeId}
                className="flex min-w-0 items-center justify-between gap-3 text-xs"
                title={node.description ? `${node.label}\n${node.description}` : node.label}
              >
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
              </li>
            ))
          ) : (
            <li className="text-xs text-neutral3">No themes detected</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function SignalDistributions({ stages }: { stages: ThemeFlowResponse['stages'] }) {
  return (
    <section aria-label="Signal distributions" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stages.map(stage => (
        <SignalDistribution
          key={stage.signalName}
          signalName={stage.signalName}
          traceCount={stage.traceCount}
          nodes={stage.nodes}
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
}: {
  columns: SankeyChartColumn[];
  records: SankeyChartRecord[];
  stages: ThemeFlowResponse['stages'];
  height?: number;
}) {
  const chartColumns = columns.map(column => ({ ...column, label: column.label.toUpperCase() }));

  return (
    <Card aria-label="Signal theme flow" as="section" className="min-w-0 overflow-hidden" elevation="elevated">
      <CardContent className="px-0 py-2 sm:py-3">
        <Sankey
          data={records}
          columns={chartColumns}
          getColumnHue={column => getSignalHue(column.id)}
          getRecordNodeId={getSignalRecordNodeId}
          getRecordNodeLabel={getSignalRecordNodeLabel}
          getRecordNodeValue={getSignalRecordNodeValue}
          getRecordWeight={record => Number(record.traceCount)}
        >
          <SankeyChart
            height={height ?? 'clamp(340px, 42vw, 460px)'}
            margin={{ top: 64, right: 32, bottom: 24, left: 32 }}
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
  const isFlowPending = flowQueries.some(query => query.isPending);
  const hasFlowError = flowQueries.some(query => query.isError);
  const flow = flowQuery?.data;
  const windowFlows = useMemo(() => flowQueries.flatMap(query => (query.data ? [query.data] : [])), [flowQueries]);
  const graphSummary = useMemo(
    () => (flow ? buildSignalGraphSummary(stabilizeThemeFlow(flow, windowFlows)) : undefined),
    [flow, windowFlows],
  );

  useEffect(() => {
    if (!isPlaying || snapshots.length < 2 || isFlowPending || hasFlowError) return;
    const timer = window.setTimeout(() => setSelectedSnapshotId(nextSnapshotId), 900);
    return () => window.clearTimeout(timer);
  }, [hasFlowError, isFlowPending, isPlaying, nextSnapshotId, snapshots.length]);

  if (snapshotsQuery.isPending) return <SignalsLoadingSkeleton />;

  if (snapshotsQuery.isError || hasFlowError) {
    return (
      <SignalsErrorState
        message="Unable to load signal flow."
        onRetry={() => {
          setIsPlaying(false);
          void Promise.all([snapshotsQuery.refetch(), ...flowQueries.map(query => query.refetch())]);
        }}
      />
    );
  }

  if (!snapshot) return <SignalsEmptyState LinkComponent={Link} />;

  if (isFlowPending) return <SignalsLoadingSkeleton />;

  const populatedStageCount = flow?.stages.filter(stage => stage.nodes.length > 0).length ?? 0;

  if (!flow || !graphSummary || populatedStageCount < 2) return <SignalsEmptyState LinkComponent={Link} />;

  const stages = flow.stages;
  const themeCount = stages.reduce(
    (total, stage) => total + stage.nodes.filter(node => node.kind === 'theme').length,
    0,
  );

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
      <FlowCard columns={graphSummary.columns} records={graphSummary.records} stages={stages} height={height} />
      <SnapshotTimeline
        snapshots={snapshots}
        selectedIndex={selectedSnapshotIndex}
        isPlaying={isPlaying}
        onPlayingChange={setIsPlaying}
        onSnapshotChange={selectSnapshot}
      />
      <SignalDistributions stages={stages} />
    </main>
  );
}
