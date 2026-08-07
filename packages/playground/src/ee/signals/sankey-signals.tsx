import type { DragStart, DragUpdate, DraggableStateSnapshot, DropResult, DroppableProvided } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable, useMouseSensor, useTouchSensor } from '@hello-pangea/dnd';
import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { nodeColor, Sankey, SankeyChart } from '@mastra/playground-ui/components/SankeyChart';
import type {
  SankeyChartColumn,
  SankeyChartNodeSelection,
  SankeyChartRecord,
} from '@mastra/playground-ui/components/SankeyChart';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { getSignalHue, SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ChartNoAxesGantt, GripVertical, Info, Waypoints, X } from 'lucide-react';
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
  dataContextLabel,
  getSignalRecordNodeId,
  getSignalRecordNodeLabel,
  getSignalRecordNodeValue,
  selectFlowSnapshotIds,
  stabilizeThemeFlow,
} from './sankey-signals-data';
import { formatSignalName, getSignalDescription, SIGNAL_DESCRIPTIONS } from './signal-formatting';
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

const DRAG_SENSORS = [useMouseSensor, useTouchSensor];

type SignalsViewMode = 'flow' | 'compare' | 'lifelines';

/** One-line answer to "what am I looking at?" for each view, shown under the tabs. */
const VIEW_DESCRIPTIONS: Record<SignalsViewMode, string> = {
  flow: "How this agent's traces distribute across goal, sentiment, behavior, and outcome themes at this point in time.",
  compare: 'Which themes grew, shrank, appeared, or disappeared between two points in time.',
  lifelines: "Each theme's share of traces across the whole selected range.",
};

const EXPLAINER_SIGNAL_ORDER: TraceSignalName[] = ['goal', 'sentiment', 'behavior', 'outcome'];

/** Info tooltip for first-time viewers: signals → themes → snapshots. */
function TraceIntelligenceExplainer() {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="What is trace intelligence?"
        className="text-neutral3 hover:text-neutral6 flex cursor-help items-center transition-colors"
        type="button"
      >
        <Icon size="sm">
          <Info />
        </Icon>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm space-y-3 p-4 text-xs">
        <p className="text-neutral5">
          Every trace from this agent is analyzed for four signals, and traces with similar signals are clustered into
          named themes.
        </p>
        <ul className="space-y-1.5">
          {EXPLAINER_SIGNAL_ORDER.map(signalName => (
            <li key={signalName} className="text-neutral4">
              <span
                className="font-mono text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: nodeColor(getSignalHue(signalName)) }}
              >
                {signalName}
              </span>{' '}
              — {SIGNAL_DESCRIPTIONS[signalName]}
            </li>
          ))}
        </ul>
        <p className="text-neutral4">
          Snapshots capture the themes at points in time, so the views show how they appear, grow, and fade.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

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
  onOrderChange,
  signalOrder,
  reorderDisabled,
}: {
  columns: SankeyChartColumn[];
  records: SankeyChartRecord[];
  stages: ThemeFlowResponse['stages'];
  height?: number;
  onNodeClick?: (selection: SankeyChartNodeSelection) => void;
  isNodeClickable?: (selection: SankeyChartNodeSelection) => boolean;
  drillInDisabledReason?: string;
  onOrderChange: (signalNames: TraceSignalName[]) => void;
  signalOrder: TraceSignalName[];
  reorderDisabled: boolean;
}) {
  const chartColumns = columns.map(column => ({ ...column, label: column.label.toUpperCase() }));
  // Keep the dropped header order visible while the matching chart data loads.
  const linkedColumnIds = new Set(columns.map(column => column.id));
  const orderedLinkedSignals = signalOrder.filter(signalName => linkedColumnIds.has(signalName));
  const orderedSignalSet = new Set(orderedLinkedSignals);
  const headerSignalNames = [
    ...orderedLinkedSignals,
    ...stages
      .map(stage => stage.signalName)
      .filter(signalName => linkedColumnIds.has(signalName) && !orderedSignalSet.has(signalName)),
  ];
  const [dragProjection, setDragProjection] = useState<{ sourceIndex: number; destinationIndex: number }>();

  const handleDragStart = (start: DragStart) => {
    setDragProjection({ sourceIndex: start.source.index, destinationIndex: start.source.index });
  };

  const handleDragUpdate = (update: DragUpdate) => {
    setDragProjection({
      sourceIndex: update.source.index,
      destinationIndex: update.destination?.index ?? update.source.index,
    });
  };

  const handleDragEnd = (result: DropResult) => {
    setDragProjection(undefined);
    const destinationIndex = result.destination?.index;
    if (destinationIndex === undefined || destinationIndex === result.source.index) return;

    const reordered = [...headerSignalNames];
    const [movedSignalName] = reordered.splice(result.source.index, 1);
    if (!movedSignalName) return;
    reordered.splice(destinationIndex, 0, movedSignalName);
    // Signals without a chart column still belong to the perspective; keep
    // them in the request after the reordered columns.
    const seen = new Set<TraceSignalName>(reordered);
    onOrderChange([...reordered, ...stages.map(stage => stage.signalName).filter(name => !seen.has(name))]);
  };

  return (
    <Card
      aria-label="Trace signal theme flow"
      as="section"
      className="relative min-w-0"
      elevation="elevated"
      title={drillInDisabledReason}
    >
      <span
        aria-hidden="true"
        className="bg-surface2 text-neutral3 absolute top-0 left-5 -translate-y-1/2 px-2 font-mono text-[10px] tracking-[0.18em]"
      >
        SIGNALS
      </span>
      <CardContent className="px-0 pt-4 pb-2 sm:pt-5 sm:pb-3">
        <div aria-label="Signals" role="group">
          <DragDropContext
            enableDefaultSensors={false}
            sensors={DRAG_SENSORS}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onDragUpdate={handleDragUpdate}
          >
            <Droppable direction="horizontal" droppableId="signal-column-headers">
              {(provided: DroppableProvided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  aria-label="Trace signal column headers"
                  className="flex items-center gap-1 px-8 pb-1"
                  role="group"
                >
                  {headerSignalNames.map((signalName, index) => {
                    const label = formatSignalName(signalName);
                    let projectedIndex = index;
                    if (dragProjection) {
                      const { sourceIndex, destinationIndex } = dragProjection;
                      if (index === sourceIndex) projectedIndex = destinationIndex;
                      else if (sourceIndex < destinationIndex && index > sourceIndex && index <= destinationIndex)
                        projectedIndex = index - 1;
                      else if (destinationIndex < sourceIndex && index >= destinationIndex && index < sourceIndex)
                        projectedIndex = index + 1;
                    }
                    const offsetPercent =
                      headerSignalNames.length > 1 ? (projectedIndex / (headerSignalNames.length - 1) - 0.5) * 100 : 0;
                    const headerAnchor =
                      projectedIndex === 0
                        ? 'start'
                        : projectedIndex === headerSignalNames.length - 1
                          ? 'end'
                          : 'middle';
                    const contentOffsetClass =
                      headerAnchor === 'start' ? 'translate-x-1/2' : headerAnchor === 'end' ? '-translate-x-1/2' : '';
                    return (
                      <Draggable
                        key={signalName}
                        draggableId={signalName}
                        index={index}
                        isDragDisabled={reorderDisabled}
                      >
                        {(dragProvided, dragSnapshot: DraggableStateSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className="flex min-w-0 flex-1 basis-0 items-center justify-center py-1"
                            data-dragging={dragSnapshot.isDragging}
                            style={dragProvided.draggableProps.style}
                          >
                            <div
                              className="flex w-full justify-center"
                              data-testid="signal-column-header-alignment"
                              style={{ translate: `${offsetPercent}%` }}
                            >
                              <div
                                className={`relative inline-flex items-center justify-center rounded-md border border-transparent px-1 py-0.5 motion-safe:transition-[background-color,border-color,box-shadow,scale] motion-safe:duration-150 ${contentOffsetClass} ${
                                  dragSnapshot.isDragging ? 'border-border2 bg-surface4 scale-[1.03] shadow-lg' : ''
                                }`}
                                data-header-anchor={headerAnchor}
                                data-testid="signal-column-header-content"
                              >
                                <Tooltip>
                                  <TooltipTrigger
                                    className="cursor-default font-mono text-xs font-semibold tracking-wider"
                                    data-testid="signal-column-header"
                                    style={{ color: nodeColor(getSignalHue(signalName)) }}
                                  >
                                    {label.toUpperCase()}
                                  </TooltipTrigger>
                                  <TooltipContent>{getSignalDescription(signalName)}</TooltipContent>
                                </Tooltip>
                                <div
                                  {...dragProvided.dragHandleProps}
                                  aria-disabled={reorderDisabled}
                                  aria-label={`Reorder ${label}`}
                                  className={`text-neutral3 hover:text-neutral5 absolute top-1/2 -translate-y-1/2 cursor-grab rounded-sm p-1 active:cursor-grabbing aria-disabled:cursor-wait aria-disabled:opacity-50 ${
                                    headerAnchor === 'end' ? 'right-full mr-0.5' : 'left-full ml-0.5'
                                  }`}
                                  title={`Drag to reorder the ${label} column`}
                                >
                                  <GripVertical aria-hidden="true" className="size-3.5" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
        <div
          aria-label="Themes"
          className="text-neutral3 flex items-center gap-2 px-4 py-1 font-mono text-[10px] tracking-[0.18em]"
          role="separator"
        >
          <span aria-hidden="true" className="bg-border1 h-px w-5" />
          THEMES
          <span aria-hidden="true" className="bg-border1 h-px flex-1" />
        </div>
        <div aria-busy={reorderDisabled} data-testid="sankey-order-transition">
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
              margin={{ top: 40, right: 32, bottom: 24, left: 32 }}
              onNodeClick={onNodeClick}
              isNodeClickable={isNodeClickable}
              hideColumnLabels
              geometryTransitionKey={chartColumns.map(column => column.id).join(':')}
            />
          </Sankey>
        </div>
      </CardContent>
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
  const [pendingSignalNames, setPendingSignalNames] = useState<TraceSignalName[]>();
  const snapshotsQuery = useThemeSnapshots(entityId, entityType, signalNames, dateFrom, dateTo);
  const snapshots = [...(snapshotsQuery.data?.snapshots ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  const [selectedSnapshotOrdinal, setSelectedSnapshotOrdinal] = useState<number>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<SignalsViewMode>('flow');
  const [drillIn, setDrillIn] = useState<ThemeSelection>();
  const [detailSelection, setDetailSelection] = useState<ThemeSelection>();
  const [noiseSignalName, setNoiseSignalName] = useState<TraceSignalName>();
  const matchedSnapshotIndex = snapshots.findIndex(snapshot => snapshot.ordinal === selectedSnapshotOrdinal);
  const selectedSnapshotIndex = matchedSnapshotIndex >= 0 ? matchedSnapshotIndex : 0;
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
    onSuccess: nextSignalNames => {
      setSignalNames(nextSignalNames);
      setPendingSignalNames(undefined);
    },
    onError: () => setPendingSignalNames(undefined),
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
          {dataContextLabel(snapshots, totalSnapshots, undefined)}
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
  // Noise nodes open the noise details panel (noise has no themeId, so it
  // cannot drill in). Theme nodes always open details; they additionally
  // isolate the flow when the snapshot is under the drill-in limit.
  const isNodeClickable = (selection: SankeyChartNodeSelection) =>
    findNoiseSelection(flow, selection.column.id, selection.value) !== undefined ||
    findThemeSelection(flow, selection.column.id, selection.value) !== undefined;
  const handleNodeClick = (selection: SankeyChartNodeSelection) => {
    const noiseSignal = findNoiseSelection(flow, selection.column.id, selection.value);
    if (noiseSignal) {
      setDetailSelection(undefined);
      setNoiseSignalName(noiseSignal);
      return;
    }
    const nextSelection = findThemeSelection(flow, selection.column.id, selection.value);
    if (!nextSelection) return;
    setNoiseSignalName(undefined);
    setDetailSelection(nextSelection);
    if (drillInAvailable) setDrillIn(nextSelection);
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
    setPendingSignalNames(nextSignalNames);
    perspectiveMutation.mutate(nextSignalNames);
  };

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
          <TraceIntelligenceExplainer />
        </div>
        {dateRangePicker}
      </div>
      <p className="text-neutral3 text-xs">{VIEW_DESCRIPTIONS[viewMode]}</p>
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
            {drillIn
              ? `Filtered · ${dataContextLabel(snapshots, totalSnapshots, flow)}`
              : dataContextLabel(snapshots, totalSnapshots, flow)}
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
