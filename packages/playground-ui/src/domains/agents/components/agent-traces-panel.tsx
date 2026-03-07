import { useState, useCallback, useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { EntityType } from '@mastra/core/observability';
import type { ListTracesResponse, SpanRecord } from '@mastra/core/storage';
import { XIcon, AlertCircle, CheckCircle2, Loader2, DatabaseIcon } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

import { useInView } from '@/hooks/use-in-view';
import { TraceDialog } from '@/domains/observability/components/trace-dialog';
import { DateTimePicker } from '@/ds/components/DateTimePicker';
import { Button } from '@/ds/components/Button/Button';
import { Checkbox } from '@/ds/components/Checkbox/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ds/components/Select';
import { Spinner } from '@/ds/components/Spinner';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { getToNextEntryFn, getToPreviousEntryFn } from '@/ds/components/EntryList/helpers';
import { is403ForbiddenError } from '@/lib/query-utils';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

const TRACES_PER_PAGE = 25;

/** Extract a readable input preview from the root span's input field */
function extractInputPreview(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;

  // Unwrap { messages: [...] } wrapper from agent spans
  let messages: unknown[] | undefined;
  if (Array.isArray(input)) {
    messages = input;
  } else if (input && typeof input === 'object' && 'messages' in input) {
    const wrapped = (input as Record<string, unknown>).messages;
    if (Array.isArray(wrapped)) messages = wrapped;
  }

  if (messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as Record<string, unknown> | undefined;
      if (msg?.role === 'user') {
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) {
          const textPart = (msg.content as Array<Record<string, unknown>>).find(p => p.type === 'text');
          if (typeof textPart?.text === 'string') return textPart.text;
        }
      }
    }
    const last = messages[messages.length - 1] as Record<string, unknown> | string | undefined;
    if (typeof last === 'string') return last;
    if (last && typeof last.content === 'string') return last.content;
  }

  return '';
}

/** Extract the raw input for dataset item (unwrap agent message wrapper) */
function extractRawInput(trace: SpanRecord): unknown {
  if (trace.input == null) return {};
  const spanInput = trace.input as Record<string, unknown> | undefined;
  const isWrappedAgentInput =
    trace.spanType === 'agent_run' &&
    spanInput &&
    typeof spanInput === 'object' &&
    !Array.isArray(spanInput) &&
    'messages' in spanInput;
  return isWrappedAgentInput ? (spanInput.messages ?? trace.input) : trace.input;
}

/** Extract output text preview from root span output */
function extractOutputPreview(output: unknown): string {
  if (!output) return '';
  if (typeof output === 'string') return output;
  if (typeof output === 'object' && output !== null) {
    const obj = output as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (obj.object) return JSON.stringify(obj.object).slice(0, 200);
  }
  return '';
}

function formatDuration(startedAt: Date | string, endedAt: Date | string | null | undefined): string {
  if (!endedAt) return '...';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimestamp(date: Date): string {
  if (isToday(date)) return format(date, 'h:mm:ss a');
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d, h:mm a');
}

function StatusIcon({ hasError, isRunning }: { hasError: boolean; isRunning: boolean }) {
  if (hasError) return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
  if (isRunning) return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-green-500/70" />;
}

type TraceSpan = SpanRecord & { status?: string };

const GRID_COLS = 'grid-cols-[2rem_auto_8rem_1fr_1fr_4.5rem]';

function TraceTableHeader({
  allSelected,
  someSelected,
  onToggleAll,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
}) {
  return (
    <div
      className={cn(
        'grid gap-3 px-4 py-2 border-b border-border1 bg-surface1 sticky top-0 z-10 items-center',
        GRID_COLS,
      )}
    >
      <div className="flex items-center justify-center">
        <Checkbox
          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
          onCheckedChange={onToggleAll}
        />
      </div>
      <div className="w-3.5" />
      <Txt variant="ui-xs" className="text-neutral3 font-medium">Timestamp</Txt>
      <Txt variant="ui-xs" className="text-neutral3 font-medium">Input</Txt>
      <Txt variant="ui-xs" className="text-neutral3 font-medium">Output</Txt>
      <Txt variant="ui-xs" className="text-neutral3 font-medium text-right">Duration</Txt>
    </div>
  );
}

function TraceTableRow({
  trace,
  isSelected,
  isChecked,
  onCheck,
  onClick,
}: {
  trace: TraceSpan;
  isSelected: boolean;
  isChecked: boolean;
  onCheck: () => void;
  onClick: () => void;
}) {
  const inputPreview = useMemo(() => extractInputPreview(trace.input), [trace.input]);
  const outputPreview = useMemo(() => extractOutputPreview(trace.output), [trace.output]);
  const hasError = trace.status === 'error' || Boolean(trace.error);
  const isRunning = trace.status === 'running' || (!trace.endedAt && !trace.error);
  const duration = formatDuration(trace.startedAt, trace.endedAt);
  const timestamp = formatTimestamp(new Date(trace.startedAt));

  const errorText = hasError && trace.error
    ? typeof trace.error === 'string'
      ? trace.error
      : (trace.error as { message?: string })?.message || 'Error'
    : '';

  return (
    <div
      className={cn(
        'grid gap-3 px-4 py-2 border-b border-border1 hover:bg-surface3 transition-colors w-full text-left items-center',
        GRID_COLS,
        isSelected && 'bg-surface3',
      )}
    >
      <div
        className="flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        <Checkbox checked={isChecked} onCheckedChange={onCheck} />
      </div>

      <button type="button" className="contents cursor-pointer" onClick={onClick}>
        <StatusIcon hasError={hasError} isRunning={isRunning} />

        <Txt variant="ui-xs" className="text-neutral3 whitespace-nowrap">
          {timestamp}
        </Txt>

        <Txt variant="ui-xs" className="text-neutral5 truncate min-w-0">
          {inputPreview || '\u2014'}
        </Txt>

        <Txt variant="ui-xs" className={cn('truncate min-w-0', hasError ? 'text-red-400' : 'text-neutral3')}>
          {hasError ? errorText || '\u2014' : outputPreview || '\u2014'}
        </Txt>

        <Txt variant="ui-xs" className="text-neutral3 font-mono text-right whitespace-nowrap">
          {duration}
        </Txt>
      </button>
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
  const [datasetId, setDatasetId] = useState('');
  const { data, isLoading: isDatasetsLoading } = useDatasets();
  const datasets = data?.datasets ?? [];

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border1 bg-surface2 shrink-0">
      <Txt variant="ui-xs" className="text-neutral5 shrink-0">
        {selectedCount} selected
      </Txt>

      <Select value={datasetId} onValueChange={setDatasetId} disabled={isPending || isDatasetsLoading}>
        <SelectTrigger className="w-48 h-7 text-xs">
          <SelectValue placeholder={isDatasetsLoading ? 'Loading...' : 'Select dataset'} />
        </SelectTrigger>
        <SelectContent>
          {datasets.length === 0 ? (
            <div className="px-2 py-4 text-sm text-neutral4 text-center">No datasets available</div>
          ) : (
            datasets.map(dataset => (
              <SelectItem key={dataset.id} value={dataset.id}>
                {dataset.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Button
        variant="light"
        size="sm"
        disabled={!datasetId || isPending || selectedCount === 0}
        onClick={() => onAdd(datasetId)}
      >
        <Icon size="sm">
          <DatabaseIcon />
        </Icon>
        {isPending ? 'Adding...' : 'Add to dataset'}
      </Button>
    </div>
  );
}

interface AgentTracesPanelProps {
  agentId: string;
}

export function AgentTracesPanel({ agentId }: AgentTracesPanelProps) {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>();
  const [dialogIsOpen, setDialogIsOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [checkedTraceIds, setCheckedTraceIds] = useState<Set<string>>(new Set());

  const filters = {
    entityId: agentId,
    entityType: EntityType.AGENT,
    ...(dateFrom && { startedAt: { start: dateFrom } }),
    ...(dateTo && { endedAt: { end: dateTo } }),
  };

  const {
    data: traces = [],
    isLoading: isTracesLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: tracesError,
  } = useInfiniteQuery({
    queryKey: ['traces', 'agent', agentId, dateFrom, dateTo],
    queryFn: ({ pageParam }) =>
      client.listTraces({
        pagination: { page: pageParam, perPage: TRACES_PER_PAGE },
        filters,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: ListTracesResponse | undefined, _allPages: unknown, lastPageParam: number) => {
      if (lastPage?.pagination?.hasMore) return lastPageParam + 1;
      return undefined;
    },
    select: (data: { pages: ListTracesResponse[] }) => {
      const seen = new Set<string>();
      return data.pages
        .flatMap(page => page.spans ?? [])
        .filter(span => {
          if (seen.has(span.traceId)) return false;
          seen.add(span.traceId);
          return true;
        });
    },
    retry: false,
    refetchInterval: (query: { state: { error: unknown } }) =>
      is403ForbiddenError(query.state.error) ? false : 3000,
  });

  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { data: selectedTrace, isLoading: isLoadingTrace } = useQuery({
    queryKey: ['trace', selectedTraceId],
    queryFn: () => client.getTrace(selectedTraceId!),
    enabled: !!selectedTraceId,
    refetchInterval: 3000,
  });

  const { data: scorers = {}, isLoading: isLoadingScorers } = useScorers();
  const { batchInsertItems } = useDatasetMutations();

  const handleTraceClick = useCallback(
    (id: string) => {
      if (id === selectedTraceId) {
        setSelectedTraceId(undefined);
        setDialogIsOpen(false);
        return;
      }
      setSelectedTraceId(id);
      setDialogIsOpen(true);
    },
    [selectedTraceId],
  );

  const handleReset = useCallback(() => {
    setDateFrom(undefined);
    setDateTo(undefined);
  }, []);

  const handleCheckToggle = useCallback((traceId: string) => {
    setCheckedTraceIds(prev => {
      const next = new Set(prev);
      if (next.has(traceId)) {
        next.delete(traceId);
      } else {
        next.add(traceId);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    setCheckedTraceIds(prev => {
      if (prev.size === traces.length) return new Set();
      return new Set(traces.map(t => t.traceId));
    });
  }, [traces]);

  const handleBulkAdd = useCallback(
    async (datasetId: string) => {
      const selectedTraces = traces.filter(t => checkedTraceIds.has(t.traceId));
      if (selectedTraces.length === 0) return;

      const items = selectedTraces.map(trace => ({
        input: extractRawInput(trace),
        groundTruth: trace.output ?? undefined,
      }));

      try {
        await batchInsertItems.mutateAsync({ datasetId, items });
        toast.success(`Added ${items.length} item${items.length > 1 ? 's' : ''} to dataset`);
        setCheckedTraceIds(new Set());
      } catch (error) {
        toast.error(`Failed to add items: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [traces, checkedTraceIds, batchInsertItems],
  );

  const computeTraceLink = useCallback(
    (traceId: string, spanId?: string) =>
      `/observability?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`,
    [],
  );

  const filtersApplied = Boolean(dateFrom || dateTo);
  const allSelected = traces.length > 0 && checkedTraceIds.size === traces.length;
  const someSelected = checkedTraceIds.size > 0;

  const toNextTrace = getToNextEntryFn({
    entries: traces.map(item => ({ id: item.traceId })),
    id: selectedTraceId,
    update: setSelectedTraceId,
  });
  const toPreviousTrace = getToPreviousEntryFn({
    entries: traces.map(item => ({ id: item.traceId })),
    id: selectedTraceId,
    update: setSelectedTraceId,
  });

  if (tracesError && is403ForbiddenError(tracesError)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Txt variant="ui-sm" className="text-neutral3">
          You don't have permission to view traces.
        </Txt>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Date filters toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border1 shrink-0">
          <Txt variant="ui-xs" className="text-neutral3 shrink-0">
            Date range
          </Txt>
          <DateTimePicker
            placeholder="From"
            value={dateFrom}
            maxValue={dateTo}
            onValueChange={setDateFrom}
            className="min-w-32"
            defaultTimeStrValue="12:00 AM"
          />
          <DateTimePicker
            placeholder="To"
            value={dateTo}
            minValue={dateFrom}
            onValueChange={setDateTo}
            className="min-w-32"
            defaultTimeStrValue="11:59 PM"
          />
          {filtersApplied && (
            <Button variant="light" size="sm" onClick={handleReset}>
              <Icon size="sm">
                <XIcon />
              </Icon>
              Reset
            </Button>
          )}
        </div>

        {/* Bulk action bar — shown when items are checked */}
        {someSelected && (
          <BulkAddToDatasetBar
            selectedCount={checkedTraceIds.size}
            onAdd={handleBulkAdd}
            isPending={batchInsertItems.isPending}
          />
        )}

        {/* Traces table */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isTracesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-5 w-5" />
            </div>
          ) : traces.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Txt variant="ui-sm" className="text-neutral3">
                {filtersApplied ? 'No traces found for the selected date range' : 'No traces yet'}
              </Txt>
            </div>
          ) : (
            <div>
              <TraceTableHeader
                allSelected={allSelected}
                someSelected={someSelected}
                onToggleAll={handleToggleAll}
              />
              {traces.map(trace => (
                <TraceTableRow
                  key={trace.traceId}
                  trace={trace}
                  isSelected={selectedTraceId === trace.traceId}
                  isChecked={checkedTraceIds.has(trace.traceId)}
                  onCheck={() => handleCheckToggle(trace.traceId)}
                  onClick={() => handleTraceClick(trace.traceId)}
                />
              ))}
              <div ref={setEndOfListElement} className="h-1">
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="h-4 w-4" />
                  </div>
                )}
                {!hasNextPage && traces.length > 0 && (
                  <div className="text-center py-3">
                    <Txt variant="ui-xs" className="text-neutral2">
                      All traces loaded
                    </Txt>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <TraceDialog
        traceSpans={selectedTrace?.spans}
        traceId={selectedTraceId}
        traceDetails={traces.find(t => t.traceId === selectedTraceId)}
        isOpen={dialogIsOpen}
        onClose={() => {
          setDialogIsOpen(false);
          setSelectedTraceId(undefined);
        }}
        onNext={toNextTrace}
        onPrevious={toPreviousTrace}
        isLoadingSpans={isLoadingTrace}
        computeTraceLink={computeTraceLink}
        scorers={scorers}
        isLoadingScorers={isLoadingScorers}
      />
    </>
  );
}
