import { TraceStatus } from '@internal-temp/core/index';
import type { ListTracesResponse, SpanRecord } from '@mastra/core/storage';
import {
  Button,
  ButtonsGroup,
  Checkbox,
  DateTimePicker,
  EntityList,
  EntityListPageLayout,
  getToNextEntryFn,
  getToPreviousEntryFn,
  SelectFieldBlock,
  ListSearch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Spinner,
  Txt,
  Icon,
  useInView,
  is403ForbiddenError,
  cn,
} from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { format, isToday, isYesterday } from 'date-fns';
import { XIcon, CheckIcon, Loader2, DatabaseIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { useAgentTraceScores } from '../hooks/use-agent-trace-scores';
import { useAgentTracesFilters } from '../hooks/use-agent-traces-filters';
import { extractErrorText } from '../utils/trace-utils';
import { BulkTraceReviewDialog } from '@/domains/datasets/components/bulk-trace-review-dialog';
import type { BulkTraceItem } from '@/domains/datasets/components/bulk-trace-review-dialog';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { TraceDialog } from '@/domains/observability/components/trace-dialog';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useLinkComponent } from '@/lib/framework';

const TRACES_PER_PAGE = 25;

// --- Utility functions ---

/** Extract a readable input preview from the root span's input field */
function extractContentFromMessage(msg: Record<string, unknown>): string | null {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    const textPart = (msg.content as Array<Record<string, unknown>>).find(p => p.type === 'text');
    if (textPart && typeof textPart.text === 'string') return textPart.text;
  }
  return null;
}

function extractLastUserMessage(messages: Array<Record<string, unknown>>): string | null {
  const userMsgs = messages.filter(m => m.role === 'user');
  const last = userMsgs[userMsgs.length - 1];
  if (last) return extractContentFromMessage(last);
  return null;
}

function extractInputPreview(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;

  // Handle array of messages directly (e.g., [{ role: 'user', content: '...' }])
  if (Array.isArray(input)) {
    const msgs = input as Array<Record<string, unknown>>;
    if (msgs.length > 0 && msgs[0]?.role) {
      const text = extractLastUserMessage(msgs);
      if (text) return text;
    }
    return JSON.stringify(input).slice(0, 200);
  }

  const obj = input as Record<string, unknown>;
  // Unwrap agent message wrapper { messages: [...] }
  if (obj.messages && Array.isArray(obj.messages)) {
    const text = extractLastUserMessage(obj.messages as Array<Record<string, unknown>>);
    if (text) return text;
  }

  // Try common fields
  if (typeof obj.prompt === 'string') return obj.prompt;
  if (typeof obj.text === 'string') return obj.text;
  if (typeof obj.query === 'string') return obj.query;
  if (typeof obj.input === 'string') return obj.input;

  return JSON.stringify(input).slice(0, 200);
}

/** Extract output text preview from root span output */
function extractOutputPreview(output: unknown): string {
  if (!output) return '';
  if (typeof output === 'string') return output;

  // Handle array of messages (e.g., [{ role: 'assistant', content: '...' }])
  if (Array.isArray(output)) {
    const msgs = output as Array<Record<string, unknown>>;
    if (msgs.length > 0 && msgs[0]?.role) {
      const assistantMsgs = msgs.filter(m => m.role === 'assistant');
      const last = assistantMsgs[assistantMsgs.length - 1];
      if (last) {
        const text = extractContentFromMessage(last);
        if (text) return text;
      }
    }
    return JSON.stringify(output).slice(0, 200);
  }

  const obj = output as Record<string, unknown>;
  if (typeof obj.text === 'string') return obj.text;
  return JSON.stringify(output).slice(0, 200);
}

function formatDuration(startedAt: Date | string, endedAt?: Date | string | null): string {
  if (!endedAt) return '—';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  const prefix = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMM d');
  return `${prefix}, ${format(d, 'h:mm a')}`;
}

type TraceSpan = SpanRecord & { status?: string };

function StatusIcon({ status }: { status: string | undefined }) {
  if (status === 'error') return <span className="inline-block size-2.5 rounded-full bg-red-500 shrink-0" />;
  if (status === 'running')
    return (
      <Icon size="sm" className="text-icon3 animate-spin shrink-0">
        <Loader2 />
      </Icon>
    );
  return (
    <Icon size="sm" className="text-icon3 shrink-0">
      <CheckIcon />
    </Icon>
  );
}

// --- Status filter options ---

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: TraceStatus.SUCCESS, label: 'Success' },
  { value: TraceStatus.ERROR, label: 'Error' },
  { value: TraceStatus.RUNNING, label: 'Running' },
];

// --- Column definitions ---

const GRID_COLUMNS = 'auto auto minmax(0, 1fr) minmax(0, 1fr) auto';
const GRID_COLUMNS_WITH_SCORE = 'auto auto minmax(0, 1fr) minmax(0, 1fr) auto auto';

// --- Sorting ---

type SortField = 'timestamp' | 'duration' | 'score';
type SortDirection = 'asc' | 'desc';
type SortState = { field: SortField; direction: SortDirection } | null;

function SortableHeader({
  children,
  field,
  sort,
  onSort,
}: {
  children: React.ReactNode;
  field: SortField;
  sort: SortState;
  onSort: Dispatch<SetStateAction<SortState>>;
}) {
  const isActive = sort?.field === field;
  const handleClick = () => {
    onSort(prev => {
      if (prev?.field !== field) return { field, direction: 'desc' };
      if (prev.direction === 'desc') return { field, direction: 'asc' };
      return null; // third click clears sort
    });
  };

  return (
    <EntityList.TopCell>
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center gap-1 uppercase tracking-widest cursor-pointer hover:text-neutral1 transition-colors',
          isActive ? 'text-neutral1' : 'text-neutral2',
        )}
      >
        {children}
        {isActive && (
          <span className="inline-flex w-3 h-3">
            {sort.direction === 'desc' ? <ArrowDownIcon className="w-3 h-3" /> : <ArrowUpIcon className="w-3 h-3" />}
          </span>
        )}
      </button>
    </EntityList.TopCell>
  );
}

// --- Sub-components ---

function AgentTracesToolbar({
  filters,
  scorerOptions,
}: {
  filters: ReturnType<typeof useAgentTracesFilters>;
  scorerOptions: { value: string; label: string }[];
}) {
  const [scoreThresholdInput, setScoreThresholdInput] = useState(filters.scoreThreshold?.toString() ?? '');

  useEffect(() => {
    setScoreThresholdInput(filters.scoreThreshold?.toString() ?? '');
  }, [filters.scoreThreshold, filters.scorerId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <ListSearch
          key={filters.resetKey}
          onSearch={filters.setSearch}
          label="Search traces"
          placeholder="Search traces..."
          debounceMs={300}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <ButtonsGroup>
          <SelectFieldBlock
            label="Status"
            labelIsHidden
            name="filter-status"
            options={STATUS_OPTIONS}
            value={filters.status}
            onValueChange={v => filters.setStatus(v as typeof filters.status)}
          />

          <DateTimePicker placeholder="From" value={filters.dateFrom} onValueChange={filters.setDateFrom} />
          <DateTimePicker placeholder="To" value={filters.dateTo} onValueChange={filters.setDateTo} />

          {scorerOptions.length > 0 && (
            <SelectFieldBlock
              label="Scorer"
              labelIsHidden
              name="filter-scorer"
              options={[{ value: 'all', label: 'All scorers' }, ...scorerOptions]}
              value={filters.scorerId ?? 'all'}
              onValueChange={v => {
                if (v === 'all') {
                  filters.setScorerId(undefined);
                  filters.setScoreThreshold(undefined);
                } else {
                  filters.setScorerId(v);
                }
              }}
            />
          )}

          {filters.scorerId && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="trace-score-threshold" className="text-ui-xs text-neutral2 whitespace-nowrap">
                Max score
              </label>
              <input
                id="trace-score-threshold"
                type="number"
                step="0.1"
                min="0"
                max="1"
                placeholder="e.g. 0.5"
                value={scoreThresholdInput}
                onChange={e => {
                  const v = e.target.value;
                  setScoreThresholdInput(v);
                  if (v === '') {
                    filters.setScoreThreshold(undefined);
                    return;
                  }
                  const n = Number.parseFloat(v);
                  if (Number.isFinite(n) && n >= 0 && n <= 1) {
                    filters.setScoreThreshold(n);
                  }
                }}
                className="w-20 h-7 rounded-md border border-border1 bg-surface1 px-2 text-ui-xs text-neutral1 focus:outline-hidden focus:ring-1 focus:ring-accent1"
              />
            </div>
          )}

          {filters.filtersApplied && (
            <Button onClick={filters.resetFilters}>
              <XIcon />
              Reset
            </Button>
          )}
        </ButtonsGroup>
      </div>
    </div>
  );
}

function BulkAddToDatasetBar({
  selectedCount,
  onAdd,
  isPending,
}: {
  selectedCount: number;
  onAdd: (datasetId: string) => void;
  isPending: boolean;
}) {
  const { data: datasets } = useDatasets();
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>();

  if (!selectedCount) return null;

  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-surface3 border-b border-border1">
      <Txt variant="ui-sm" className="text-icon3 shrink-0">
        {selectedCount} trace{selectedCount !== 1 ? 's' : ''} selected
      </Txt>
      <Select value={selectedDatasetId ?? ''} onValueChange={setSelectedDatasetId}>
        <SelectTrigger>
          <SelectValue placeholder={datasets?.datasets?.length ? 'Select dataset' : 'No datasets'} />
        </SelectTrigger>
        <SelectContent>
          {datasets?.datasets?.length ? (
            datasets.datasets.map(d => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))
          ) : (
            <div className="px-3 py-2 text-ui-xs text-icon3">No datasets available</div>
          )}
        </SelectContent>
      </Select>
      <Button disabled={!selectedDatasetId || isPending} onClick={() => selectedDatasetId && onAdd(selectedDatasetId)}>
        <Icon size="sm">
          <DatabaseIcon />
        </Icon>
        {isPending ? 'Adding...' : 'Add to dataset'}
      </Button>
    </div>
  );
}

// --- Main component ---

type AgentTracesPanelProps = {
  agentId: string;
  basePath?: string;
  initialTraceId?: string;
  initialSpanId?: string;
  initialSpanTab?: string;
  initialScoreId?: string;
};

export function AgentTracesPanel({
  agentId,
  basePath,
  initialTraceId,
  initialSpanId,
  initialSpanTab,
  initialScoreId,
}: AgentTracesPanelProps) {
  const client = useMastraClient();
  const filters = useAgentTracesFilters(agentId);
  const { navigate } = useLinkComponent();

  const buildTraceUrl = useCallback(
    (traceId?: string, spanId?: string, scoreId?: string, tab?: string) => {
      const params = new URLSearchParams();

      if (traceId) params.set('traceId', traceId);
      if (spanId) params.set('spanId', spanId);
      if (tab) params.set('tab', tab);
      if (scoreId) params.set('scoreId', scoreId);

      const query = params.toString();
      return query ? `${basePath ?? `/agents/${agentId}/traces`}?${query}` : (basePath ?? `/agents/${agentId}/traces`);
    },
    [agentId, basePath],
  );

  // Selected trace dialog state
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>(initialTraceId);
  const [dialogIsOpen, setDialogIsOpen] = useState(Boolean(initialTraceId));
  const [checkedTraceIds, setCheckedTraceIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState>(null);

  // Infinite trace list query
  const {
    data: tracesData,
    isLoading: isTracesLoading,
    error: tracesError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['agent-traces', agentId, filters.apiFilters],
    queryFn: ({ pageParam = 0 }) =>
      client.listTraces({
        pagination: { page: pageParam, perPage: TRACES_PER_PAGE },
        filters: filters.apiFilters,
      }) as Promise<ListTracesResponse>,
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage?.pagination?.hasMore ? lastPageParam + 1 : undefined,
    select: data => {
      const seen = new Set<string>();
      return data.pages.flatMap(page =>
        (page?.spans ?? []).filter(span => {
          if (seen.has(span.traceId)) return false;
          seen.add(span.traceId);
          return true;
        }),
      );
    },
    refetchInterval: query => (is403ForbiddenError(query.state.error) ? false : 3000),
  });

  const traces = useMemo<TraceSpan[]>(() => tracesData ?? [], [tracesData]);

  // Client-side search filter
  const filteredTraces = useMemo(() => {
    if (!filters.search) return traces;
    const q = filters.search.toLowerCase();
    return traces.filter(t => {
      const inp = extractInputPreview(t.input).toLowerCase();
      const out = extractOutputPreview(t.output).toLowerCase();
      const err = extractErrorText(t.error).toLowerCase();
      return inp.includes(q) || out.includes(q) || err.includes(q);
    });
  }, [traces, filters.search]);

  // Infinite scroll
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();
  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Selected trace detail query (lightweight — only fetch fields needed for timeline)
  const { data: selectedTraceLight, isLoading: isSelectedTraceLoading } = useQuery({
    queryKey: ['agent-trace-light', selectedTraceId],
    queryFn: () => client.getTraceLight(selectedTraceId!),
    enabled: Boolean(selectedTraceId),
    refetchInterval: 3000,
  });

  // Scorers
  const { data: scorersMap, isLoading: isLoadingScorers } = useScorers();
  const scorerOptions = useMemo(
    () =>
      Object.entries(scorersMap ?? {}).map(([id, s]) => ({
        value: id,
        label: (s as any).scorer?.config?.name ?? (s as any).scorer?.name ?? id,
      })),
    [scorersMap],
  );

  // Score enrichment
  const { scoresByTraceId, isLoading: isTraceScoresLoading } = useAgentTraceScores({
    agentId,
    scorerId: filters.scorerId,
    enabled: Boolean(filters.scorerId),
  });

  // Client-side score filtering — skip while scores are still loading
  // to avoid clearing the list (and bulk selection) before data arrives
  const scoreFilteredTraces = useMemo(() => {
    if (!filters.scorerId || filters.scoreThreshold === undefined || isTraceScoresLoading) return filteredTraces;
    return filteredTraces.filter(t => {
      const scores = scoresByTraceId.get(t.traceId);
      if (!scores?.length) return false;
      return scores.some(s => s.score <= filters.scoreThreshold!);
    });
  }, [filteredTraces, filters.scorerId, filters.scoreThreshold, scoresByTraceId, isTraceScoresLoading]);

  const scorerActive = Boolean(filters.scorerId);

  // Client-side sorting
  const displayTraces = useMemo(() => {
    if (!sort) return scoreFilteredTraces;
    const sorted = [...scoreFilteredTraces];
    const dir = sort.direction === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sort.field) {
        case 'timestamp': {
          const ta = new Date(a.startedAt).getTime();
          const tb = new Date(b.startedAt).getTime();
          return (ta - tb) * dir;
        }
        case 'duration': {
          const da = a.endedAt ? new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime() : 0;
          const db = b.endedAt ? new Date(b.endedAt).getTime() - new Date(b.startedAt).getTime() : 0;
          return (da - db) * dir;
        }
        case 'score': {
          const sa = scoresByTraceId.get(a.traceId)?.[0]?.score ?? -Infinity;
          const sb = scoresByTraceId.get(b.traceId)?.[0]?.score ?? -Infinity;
          return (sa - sb) * dir;
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [scoreFilteredTraces, sort, scoresByTraceId]);

  // Prune checked IDs when the displayed set changes
  useEffect(() => {
    if (checkedTraceIds.size === 0) return;
    const visibleIds = new Set(displayTraces.map(t => t.traceId));
    setCheckedTraceIds(prev => {
      const next = new Set<string>();
      for (const id of prev) {
        if (visibleIds.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [displayTraces, checkedTraceIds.size]);

  // Bulk review dialog state
  const [bulkReview, setBulkReview] = useState<{
    isOpen: boolean;
    datasetId: string;
    datasetName: string;
    items: BulkTraceItem[];
  }>({ isOpen: false, datasetId: '', datasetName: '', items: [] });

  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    if (initialTraceId) {
      setSelectedTraceId(initialTraceId);
      setDialogIsOpen(true);
      return;
    }

    setSelectedTraceId(undefined);
    setDialogIsOpen(false);
  }, [initialTraceId]);

  // Selection state
  const allSelected = displayTraces.length > 0 && displayTraces.every(t => checkedTraceIds.has(t.traceId));
  const someSelected = checkedTraceIds.size > 0;

  // Handlers
  const handleTraceClick = useCallback(
    (traceId: string) => {
      if (selectedTraceId === traceId) {
        navigate(buildTraceUrl());
        setSelectedTraceId(undefined);
        setDialogIsOpen(false);
      } else {
        navigate(buildTraceUrl(traceId));
        setSelectedTraceId(traceId);
        setDialogIsOpen(true);
      }
    },
    [buildTraceUrl, navigate, selectedTraceId],
  );

  const handleCheckToggle = useCallback((traceId: string, checked: boolean) => {
    setCheckedTraceIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(traceId);
      } else {
        next.delete(traceId);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      setCheckedTraceIds(new Set());
    } else {
      setCheckedTraceIds(new Set(displayTraces.map(t => t.traceId)));
    }
  }, [allSelected, displayTraces]);

  const { data: allDatasets } = useDatasets();

  const handleBulkAdd = useCallback(
    async (datasetId: string) => {
      const selected = displayTraces.filter(t => checkedTraceIds.has(t.traceId));
      if (!selected.length) return;

      setIsPreparing(true);
      try {
        // Fetch trajectories in batches to avoid unbounded fan-out
        const BATCH_SIZE = 5;
        const trajectories: Array<Record<string, unknown> | undefined> = [];
        for (let i = 0; i < selected.length; i += BATCH_SIZE) {
          const batch = selected.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(
            batch.map(t => client.getTraceTrajectory(t.traceId).catch(() => undefined)),
          );
          trajectories.push(...results);
        }

        const items: BulkTraceItem[] = selected.map((t, i) => {
          const trajectory = trajectories[i] as { steps?: Array<Record<string, unknown>> } | undefined;
          let trajectoryExpectation: Record<string, unknown> | undefined;
          if (trajectory?.steps && trajectory.steps.length > 0) {
            trajectoryExpectation = {
              steps: trajectory.steps.map(step => {
                const { name, stepType, ...rest } = step as Record<string, unknown>;
                const expected: Record<string, unknown> = { name, stepType };
                for (const [k, v] of Object.entries(rest)) {
                  if (v != null && k !== 'durationMs' && k !== 'metadata' && k !== 'children') {
                    expected[k] = v;
                  }
                }
                return expected;
              }),
              ordering: 'relaxed' as const,
            };
          }

          const formatJson = (val: unknown) => (val != null ? JSON.stringify(val, null, 2) : '');

          // Unwrap agent_run { messages } wrapper to preserve full conversation input
          const rawInput =
            t.spanType === 'agent_run' &&
            t.input &&
            typeof t.input === 'object' &&
            !Array.isArray(t.input) &&
            Array.isArray((t.input as Record<string, unknown>).messages)
              ? (t.input as Record<string, unknown>).messages
              : t.input;

          return {
            input: formatJson(rawInput),
            groundTruth: formatJson(t.output),
            expectedTrajectory: formatJson(trajectoryExpectation),
            source: { type: 'trace' as const, referenceId: t.traceId },
          };
        });

        const datasetName = allDatasets?.datasets?.find(d => d.id === datasetId)?.name ?? 'dataset';

        setBulkReview({ isOpen: true, datasetId, datasetName, items });
      } finally {
        setIsPreparing(false);
      }
    },
    [displayTraces, checkedTraceIds, client, allDatasets],
  );

  const computeTraceLink = useCallback(
    (traceId: string, spanId?: string, tab?: string) => buildTraceUrl(traceId, spanId, undefined, tab),
    [buildTraceUrl],
  );

  // Trace navigation in dialog
  const toNextTrace = useMemo(
    () =>
      getToNextEntryFn({
        entries: displayTraces.map(t => ({ id: t.traceId })),
        id: selectedTraceId,
        update: (id: string) => {
          navigate(buildTraceUrl(id));
          setSelectedTraceId(id);
          setDialogIsOpen(true);
        },
      }),
    [buildTraceUrl, displayTraces, navigate, selectedTraceId],
  );

  const toPreviousTrace = useMemo(
    () =>
      getToPreviousEntryFn({
        entries: displayTraces.map(t => ({ id: t.traceId })),
        id: selectedTraceId,
        update: (id: string) => {
          navigate(buildTraceUrl(id));
          setSelectedTraceId(id);
          setDialogIsOpen(true);
        },
      }),
    [buildTraceUrl, displayTraces, navigate, selectedTraceId],
  );

  const gridColumns = scorerActive ? GRID_COLUMNS_WITH_SCORE : GRID_COLUMNS;

  // Error display
  if (tracesError && !traces.length) {
    const is403 = is403ForbiddenError(tracesError);
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <AgentTracesToolbar filters={filters} scorerOptions={[]} />
        </EntityListPageLayout.Top>
        <div className="flex items-center justify-center h-full">
          <Txt variant="ui-md" className="text-icon3">
            {is403 ? "You don't have permission to view traces." : 'Failed to load traces.'}
          </Txt>
        </div>
      </EntityListPageLayout>
    );
  }

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <AgentTracesToolbar filters={filters} scorerOptions={scorerOptions} />
      </EntityListPageLayout.Top>

      {someSelected && (
        <BulkAddToDatasetBar selectedCount={checkedTraceIds.size} onAdd={handleBulkAdd} isPending={isPreparing} />
      )}

      {isTracesLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : displayTraces.length === 0 ? (
        <>
          <div className="flex items-center justify-center py-20">
            <Txt variant="ui-md" className="text-icon3">
              {filters.filtersApplied ? 'No traces match the current filters.' : 'No traces yet.'}
            </Txt>
          </div>
          {/* Keep the sentinel mounted so pagination can advance when client-side filters hide all current results */}
          <div ref={setEndOfListElement} className="h-1">
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}
          </div>
        </>
      ) : (
        <EntityList columns={gridColumns}>
          <EntityList.Top className="pl-6">
            <EntityList.TopCell>
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={handleToggleAll}
              />
            </EntityList.TopCell>
            <SortableHeader field="timestamp" sort={sort} onSort={setSort}>
              Timestamp
            </SortableHeader>
            <EntityList.TopCell>Input</EntityList.TopCell>
            <EntityList.TopCell>Output</EntityList.TopCell>
            <SortableHeader field="duration" sort={sort} onSort={setSort}>
              Duration
            </SortableHeader>
            {scorerActive && (
              <SortableHeader field="score" sort={sort} onSort={setSort}>
                Score
              </SortableHeader>
            )}
          </EntityList.Top>

          <EntityList.Rows>
            {displayTraces.map(trace => {
              const isError = trace.status === 'error' || Boolean(trace.error);
              const isRunning = trace.status === 'running' || (!trace.endedAt && !trace.error);
              const status = isError ? 'error' : isRunning ? 'running' : 'success';
              const isChecked = checkedTraceIds.has(trace.traceId);
              const isSelected = selectedTraceId === trace.traceId;
              const traceScores = scoresByTraceId.get(trace.traceId);
              const scoreValue = traceScores?.length ? traceScores[0]!.score : undefined;
              const scoreDisplay = scoreValue !== undefined ? scoreValue.toFixed(2) : '—';

              return (
                <EntityList.Row
                  key={trace.traceId}
                  onClick={() => handleTraceClick(trace.traceId)}
                  selected={isSelected}
                >
                  <EntityList.Cell>
                    <div
                      onClick={e => {
                        e.stopPropagation();
                      }}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={checked => handleCheckToggle(trace.traceId, checked === true)}
                      />
                    </div>
                  </EntityList.Cell>
                  <EntityList.Cell>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <StatusIcon status={status} />
                      <span className="text-ui-md text-icon3">{formatTimestamp(trace.startedAt)}</span>
                    </div>
                  </EntityList.Cell>
                  <EntityList.TextCell>
                    <span className="truncate block">{extractInputPreview(trace.input)}</span>
                  </EntityList.TextCell>
                  <EntityList.TextCell>
                    <span className={cn('truncate block', isError && 'text-red-500')}>
                      {isError ? extractErrorText(trace.error) : extractOutputPreview(trace.output)}
                    </span>
                  </EntityList.TextCell>
                  <EntityList.TextCell>{formatDuration(trace.startedAt, trace.endedAt)}</EntityList.TextCell>
                  {scorerActive && (
                    <EntityList.TextCell>
                      <span className="font-mono text-icon3">{scoreDisplay}</span>
                    </EntityList.TextCell>
                  )}
                </EntityList.Row>
              );
            })}

            <div ref={setEndOfListElement} className="h-1 col-span-full">
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <Spinner />
                </div>
              )}
              {!hasNextPage && displayTraces.length > 0 && (
                <Txt variant="ui-xs" className="text-icon3 text-center py-4 block">
                  All traces loaded
                </Txt>
              )}
            </div>
          </EntityList.Rows>
        </EntityList>
      )}

      {/* Stale data warning */}
      {tracesError && traces.length > 0 && (
        <div className="px-5 py-2">
          <Txt variant="ui-xs" className="text-yellow-500">
            Data may be stale — failed to refresh.
          </Txt>
        </div>
      )}

      {selectedTraceId && dialogIsOpen && (
        <TraceDialog
          traceSpans={selectedTraceLight?.spans}
          traceId={selectedTraceId}
          isOpen={dialogIsOpen}
          onClose={() => {
            navigate(buildTraceUrl());
            setDialogIsOpen(false);
            setSelectedTraceId(undefined);
          }}
          onNext={toNextTrace}
          onPrevious={toPreviousTrace}
          isLoadingSpans={isSelectedTraceLoading}
          computeTraceLink={computeTraceLink}
          initialSpanId={initialSpanId}
          initialSpanTab={initialSpanTab}
          initialScoreId={initialScoreId}
          scorers={scorersMap}
          isLoadingScorers={isLoadingScorers}
        />
      )}

      <BulkTraceReviewDialog
        isOpen={bulkReview.isOpen}
        onClose={() => {
          setBulkReview(prev => ({ ...prev, isOpen: false }));
          setCheckedTraceIds(new Set());
        }}
        datasetId={bulkReview.datasetId}
        datasetName={bulkReview.datasetName}
        initialItems={bulkReview.items}
      />
    </EntityListPageLayout>
  );
}
