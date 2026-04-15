import type { ScoreRowData } from '@mastra/core/evals';
import type { SpanRecord } from '@mastra/core/storage';
import { TracesDataList, DataListSkeleton, cn } from '@mastra/playground-ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllSpanIds } from '../hooks/get-all-span-ids';
import { useTraceSpans } from '../hooks/use-trace-spans';
import { groupTracesByThread } from '../utils/group-traces-by-thread';
import { getInputPreview } from '../utils/span-utils';
import { formatHierarchicalSpans } from './format-hierarchical-spans';
import { ScoreDataPanel } from './score-data-panel';
import { SpanDataPanel } from './span-data-panel';
import { TraceDataPanel } from './trace-data-panel';
import { useScorers } from '@/domains/scores';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';

type Trace = {
  traceId: string;
  name: string;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  attributes?: Record<string, any> | null;
  input?: unknown;
  startedAt?: Date | string | null;
  createdAt: Date | string;
  threadId?: string | null;
};

const COLUMNS = 'auto auto auto auto minmax(5rem,1fr) auto auto';

export type SpanTab = 'details' | 'scoring';

export interface ObservabilityTracesListProps {
  traces: Trace[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  filtersApplied?: boolean;
  selectedTraceId?: string;
  initialSpanId?: string;
  initialSpanTab?: SpanTab;
  initialScoreId?: string;
  onTraceClick?: (traceId: string) => void;
  onSpanChange?: (spanId: string | null) => void;
  onSpanTabChange?: (tab: SpanTab) => void;
  onScoreChange?: (scoreId: string | null) => void;
  groupByThread?: boolean;
  threadTitles?: Record<string, string>;
}

export function ObservabilityTracesList({
  traces,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  filtersApplied,
  selectedTraceId,
  initialSpanId,
  initialSpanTab,
  initialScoreId,
  onTraceClick,
  onSpanChange,
  onSpanTabChange,
  onScoreChange,
  groupByThread,
  threadTitles,
}: ObservabilityTracesListProps) {
  const [featuredTraceId, setFeaturedTraceId] = useState<string | null>(selectedTraceId ?? null);
  const [featuredSpanRecord, setFeaturedSpanRecord] = useState<SpanRecord | undefined>();
  const [featuredSpanId, setFeaturedSpanId] = useState<string | null>(initialSpanId ?? null);
  const [spanScoresPage, setSpanScoresPage] = useState(0);
  const [featuredScore, setFeaturedScore] = useState<ScoreRowData | undefined>();
  const [spanTab, setSpanTab] = useState<SpanTab>(initialSpanTab ?? 'details');
  const [traceCollapsed, setTraceCollapsed] = useState(false);

  const { data: scorers, isLoading: isLoadingScorers } = useScorers();
  const { data: spanScoresData, isLoading: isLoadingSpanScoresData } = useTraceSpanScores({
    traceId: featuredTraceId ?? undefined,
    spanId: featuredSpanId ?? undefined,
    page: spanScoresPage,
  });

  // Sync with external selectedTraceId
  useEffect(() => {
    if (selectedTraceId !== undefined) {
      setFeaturedTraceId(selectedTraceId ?? null);
    }
  }, [selectedTraceId]);

  // Sync with external initialSpanId
  useEffect(() => {
    if (initialSpanId !== undefined) {
      setFeaturedSpanId(initialSpanId ?? null);
    }
  }, [initialSpanId]);

  // Sync with external initialSpanTab
  useEffect(() => {
    if (initialSpanTab !== undefined) {
      setSpanTab(initialSpanTab);
    }
  }, [initialSpanTab]);

  // Resolve initialScoreId once scores data loads
  useEffect(() => {
    if (initialScoreId && spanScoresData?.scores && !featuredScore) {
      const match = spanScoresData.scores.find(s => s.id === initialScoreId);
      if (match) setFeaturedScore(match);
    }
  }, [initialScoreId, spanScoresData?.scores, featuredScore]);

  const resetSpanState = useCallback(() => {
    setFeaturedSpanRecord(undefined);
    setFeaturedSpanId(null);
    setFeaturedScore(undefined);
    setSpanTab('details');
  }, []);

  const handleTraceClick = useCallback(
    (trace: Trace) => {
      const id = trace.traceId;
      if (featuredTraceId === id) {
        setFeaturedTraceId(null);
        resetSpanState();
        onTraceClick?.('');
        return;
      }
      setFeaturedTraceId(id);
      resetSpanState();
      onTraceClick?.(id);
    },
    [featuredTraceId, onTraceClick, resetSpanState],
  );

  const handleTraceClose = useCallback(() => {
    setFeaturedTraceId(null);
    resetSpanState();
    onTraceClick?.('');
  }, [onTraceClick, resetSpanState]);

  const handleSpanSelect = useCallback(
    (span: SpanRecord | undefined) => {
      const id = span?.spanId ?? null;
      const isSameSpan = id === featuredSpanId;
      setFeaturedSpanId(id);
      setFeaturedSpanRecord(span);
      if (!isSameSpan) {
        setFeaturedScore(undefined);
        setSpanTab('details');
        if (id) {
          onSpanChange?.(id);
        }
      }
    },
    [featuredSpanId, onSpanChange],
  );

  const handleSpanClose = useCallback(() => {
    setFeaturedSpanId(null);
    setFeaturedSpanRecord(undefined);
    setFeaturedScore(undefined);
    setSpanTab('details');
    onSpanChange?.(null);
  }, [onSpanChange]);

  const handleSpanTabChange = useCallback(
    (tab: string) => {
      setSpanTab(tab as SpanTab);
      onSpanTabChange?.(tab as SpanTab);
    },
    [onSpanTabChange],
  );

  const handleScoreSelect = useCallback(
    (score: ScoreRowData) => {
      setFeaturedScore(score);
      onScoreChange?.(score.id);
    },
    [onScoreChange],
  );

  const handleScoreClose = useCallback(() => {
    setFeaturedScore(undefined);
    onScoreChange?.(null);
  }, [onScoreChange]);

  const traceIdToTrace = useMemo(() => {
    const m = new Map<string, { trace: Trace; idx: number }>();
    for (let i = 0; i < traces.length; i++) {
      m.set(traces[i].traceId, { trace: traces[i], idx: i });
    }
    return m;
  }, [traces]);

  const featuredEntry = featuredTraceId ? traceIdToTrace.get(featuredTraceId) : undefined;
  const featuredIdx = featuredEntry?.idx ?? -1;

  const { data: traceData } = useTraceSpans(featuredTraceId);
  const traceSpans = useMemo(() => traceData?.spans ?? [], [traceData?.spans]);

  const handleEvaluateTrace = useCallback(() => {
    const rootSpan = traceSpans.find(s => s.parentSpanId == null);
    if (rootSpan) {
      setFeaturedSpanId(rootSpan.spanId);
      setFeaturedSpanRecord(rootSpan);
      setSpanTab('scoring');
      onSpanChange?.(rootSpan.spanId);
      onSpanTabChange?.('scoring');
    }
  }, [traceSpans, onSpanChange, onSpanTabChange]);

  const timelineSpanIds = useMemo(() => getAllSpanIds(formatHierarchicalSpans(traceSpans)), [traceSpans]);

  const spanIdToRecord = useMemo(() => {
    const m = new Map<string, SpanRecord>();
    for (const s of traceSpans) m.set(s.spanId, s);
    return m;
  }, [traceSpans]);

  const featuredSpanIdx = featuredSpanId ? timelineSpanIds.indexOf(featuredSpanId) : -1;

  const handlePreviousSpan =
    featuredSpanIdx > 0
      ? () => {
          const prevId = timelineSpanIds[featuredSpanIdx - 1];
          setFeaturedSpanId(prevId);
          setFeaturedSpanRecord(spanIdToRecord.get(prevId));
          onSpanChange?.(prevId);
        }
      : undefined;

  const handleNextSpan =
    featuredSpanIdx >= 0 && featuredSpanIdx < timelineSpanIds.length - 1
      ? () => {
          const nextId = timelineSpanIds[featuredSpanIdx + 1];
          setFeaturedSpanId(nextId);
          setFeaturedSpanRecord(spanIdToRecord.get(nextId));
          onSpanChange?.(nextId);
        }
      : undefined;

  const handlePreviousTrace =
    featuredIdx > 0
      ? () => {
          const prevTrace = traces[featuredIdx - 1];
          setFeaturedTraceId(prevTrace.traceId);
          resetSpanState();
          onTraceClick?.(prevTrace.traceId);
        }
      : undefined;

  const handleNextTrace =
    featuredIdx >= 0 && featuredIdx < traces.length - 1
      ? () => {
          const nextTrace = traces[featuredIdx + 1];
          setFeaturedTraceId(nextTrace.traceId);
          resetSpanState();
          onTraceClick?.(nextTrace.traceId);
        }
      : undefined;

  if (isLoading) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  const hasSidePanel = !!featuredTraceId;

  const renderTraceRows = (rows: Trace[]) =>
    rows.map(trace => {
      const isFeatured = trace.traceId === featuredTraceId;
      const displayDate = trace.startedAt ?? trace.createdAt;
      const entityName =
        trace.entityName || trace.entityId || trace.attributes?.agentId || trace.attributes?.workflowId;

      return (
        <TracesDataList.RowButton
          key={trace.traceId}
          onClick={() => handleTraceClick(trace)}
          className={cn(isFeatured && 'bg-surface4')}
        >
          <TracesDataList.IdCell traceId={trace.traceId} />
          <TracesDataList.DateCell timestamp={displayDate} />
          <TracesDataList.TimeCell timestamp={displayDate} />
          <TracesDataList.NameCell name={trace.name} />
          <TracesDataList.InputCell input={getInputPreview(trace.input)} />
          <TracesDataList.EntityCell entityType={trace.entityType} entityName={entityName} />
          <TracesDataList.StatusCell status={trace.attributes?.status} />
        </TracesDataList.RowButton>
      );
    });

  return (
    <div
      className={cn('grid h-full min-h-0 gap-4 items-start ', hasSidePanel ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr]')}
    >
      <TracesDataList columns={COLUMNS} className="min-w-0">
        <TracesDataList.Top>
          <TracesDataList.TopCell>ID</TracesDataList.TopCell>
          <TracesDataList.TopCell>Date</TracesDataList.TopCell>
          <TracesDataList.TopCell>Time</TracesDataList.TopCell>
          <TracesDataList.TopCell>Name</TracesDataList.TopCell>
          <TracesDataList.TopCell>Input</TracesDataList.TopCell>
          <TracesDataList.TopCell>Entity</TracesDataList.TopCell>
          <TracesDataList.TopCell>Status</TracesDataList.TopCell>
        </TracesDataList.Top>

        {traces.length === 0 ? (
          <TracesDataList.NoMatch
            message={filtersApplied ? 'No traces found for applied filters' : 'No traces found yet'}
          />
        ) : groupByThread ? (
          (() => {
            const { groups, ungrouped } = groupTracesByThread(traces);
            return (
              <>
                {groups.map(group => (
                  <React.Fragment key={group.threadId}>
                    <TracesDataList.Subheader>
                      <TracesDataList.SubHeading className="flex gap-2">
                        <span className="uppercase">Thread</span>
                        {threadTitles?.[group.threadId] && <b>'{threadTitles[group.threadId]}'</b>}
                        <b># {group.threadId}</b>
                        <span className="text-neutral2">({group.traces.length})</span>
                      </TracesDataList.SubHeading>
                    </TracesDataList.Subheader>
                    {renderTraceRows(group.traces)}
                  </React.Fragment>
                ))}
                {ungrouped.length > 0 && (
                  <>
                    <TracesDataList.Subheader>
                      <TracesDataList.SubHeading className="flex gap-2 uppercase">
                        <span>No thread</span>
                        <span className="text-neutral2">({ungrouped.length})</span>
                      </TracesDataList.SubHeading>
                    </TracesDataList.Subheader>
                    {renderTraceRows(ungrouped)}
                  </>
                )}
              </>
            );
          })()
        ) : (
          renderTraceRows(traces)
        )}
        {traces.length > 0 && (
          <TracesDataList.NextPageLoading
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
            setEndOfListElement={setEndOfListElement}
          />
        )}
      </TracesDataList>

      {featuredTraceId && (
        <div
          className={cn(
            'grid gap-4 h-full overflow-auto',
            featuredScore
              ? traceCollapsed
                ? 'grid-rows-[auto_3fr_3fr]'
                : 'grid-rows-[2fr_3fr_3fr]'
              : featuredSpanRecord
                ? traceCollapsed
                  ? 'grid-rows-[auto_3fr]'
                  : 'grid-rows-[2fr_3fr]'
                : traceCollapsed
                  ? 'grid-rows-[auto]'
                  : 'grid-rows-[1fr]',
          )}
        >
          <TraceDataPanel
            traceId={featuredTraceId}
            onClose={handleTraceClose}
            onSpanSelect={handleSpanSelect}
            onEvaluateTrace={handleEvaluateTrace}
            initialSpanId={featuredSpanId}
            onPrevious={handlePreviousTrace}
            onNext={handleNextTrace}
            collapsed={traceCollapsed}
            onCollapsedChange={setTraceCollapsed}
          />
          {featuredSpanRecord && (
            <SpanDataPanel
              span={featuredSpanRecord}
              onClose={handleSpanClose}
              onPrevious={handlePreviousSpan}
              onNext={handleNextSpan}
              scorers={scorers}
              isLoadingScorers={isLoadingScorers}
              spanScoresData={spanScoresData}
              isLoadingSpanScoresData={isLoadingSpanScoresData}
              onSpanScoresPageChange={setSpanScoresPage}
              onScoreSelect={handleScoreSelect}
              activeTab={spanTab}
              onTabChange={handleSpanTabChange}
            />
          )}
          {featuredScore && <ScoreDataPanel score={featuredScore} onClose={handleScoreClose} />}
        </div>
      )}
    </div>
  );
}
