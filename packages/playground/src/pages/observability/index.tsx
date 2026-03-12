import { EntityType } from '@mastra/core/observability';
import type { EntityOptions } from '@mastra/playground-ui';
import {
  HeaderTitle,
  Header,
  MainContentLayout,
  TracesList,
  tracesListColumns,
  PageHeader,
  TracesTools,
  TraceDialog,
  parseError,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  EntryListSkeleton,
  getToNextEntryFn,
  getToPreviousEntryFn,
  groupTracesByThread,
  useAgents,
  useWorkflows,
  useScorers,
  PermissionDenied,
  is403ForbiddenError,
} from '@mastra/playground-ui';

import { EyeIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTrace } from '@/domains/observability/hooks/use-trace';
import { useTraces } from '@/domains/observability/hooks/use-traces';

import { cn } from '@/lib/utils';

export default function Observability() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>();
  const [selectedEntityOption, setSelectedEntityOption] = useState<EntityOptions | undefined>({
    value: 'all',
    label: 'All',
    type: 'all' as const,
  });
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(undefined);
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);
  const [groupByThread, setGroupByThread] = useState<boolean>(false);
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const { data: agents = {}, isLoading: isLoadingAgents } = useAgents();
  const { data: workflows, isLoading: isLoadingWorkflows } = useWorkflows();
  const { data: scorers = {}, isLoading: isLoadingScorers } = useScorers();

  const { data: Trace, isLoading: isLoadingTrace } = useTrace(selectedTraceId, { enabled: !!selectedTraceId });

  const traceId = searchParams.get('traceId');
  const spanId = searchParams.get('spanId');
  const spanTab = searchParams.get('tab');
  const scoreId = searchParams.get('scoreId');

  const {
    data: tracesData,
    isLoading: isTracesLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error: TracesError,
    isError: isTracesError,
  } = useTraces({
    filters: {
      ...(selectedEntityOption?.type !== 'all' && {
        entityId: selectedEntityOption?.value,
        entityType: selectedEntityOption?.type,
      }),
      ...(selectedDateFrom && {
        startedAt: {
          start: selectedDateFrom,
        },
      }),
      ...(selectedDateTo && {
        endedAt: {
          end: selectedDateTo,
        },
      }),
    },
  });

  const traces = useMemo(() => tracesData?.spans ?? [], [tracesData?.spans]);
  const threadTitles = tracesData?.threadTitles ?? {};

  // Sync URL traceId to state
  if (traceId && traceId !== selectedTraceId) {
    setSelectedTraceId(traceId);
    setDialogIsOpen(true);
  }

  const agentOptions: EntityOptions[] = useMemo(
    () =>
      (Object.entries(agents) || []).map(([_, value]) => ({
        value: value.id,
        label: value.name,
        type: EntityType.AGENT,
      })),
    [agents],
  );

  const workflowOptions: EntityOptions[] = useMemo(
    () =>
      (Object.entries(workflows || {}) || []).map(([, value]) => ({
        value: value.name,
        label: value.name,
        type: EntityType.WORKFLOW_RUN,
      })),
    [workflows],
  );

  const entityOptions: EntityOptions[] = useMemo(
    () => [{ value: 'all', label: 'All', type: 'all' as const }, ...agentOptions, ...workflowOptions],
    [agentOptions, workflowOptions],
  );

  // Sync URL entity to state
  const entityName = searchParams.get('entity');
  const matchedEntityOption = entityOptions.find(option => option.value === entityName);
  if (matchedEntityOption && matchedEntityOption.value !== selectedEntityOption?.value) {
    setSelectedEntityOption(matchedEntityOption);
  }

  const handleReset = () => {
    setSelectedTraceId(undefined);
    setSearchParams({ entity: 'all', traceId: '' });
    setDialogIsOpen(false);
    setSelectedDateFrom(undefined);
    setSelectedDateTo(undefined);
    setGroupByThread(false);
  };

  const handleDataChange = (value: Date | undefined, type: 'from' | 'to') => {
    if (type === 'from') {
      return setSelectedDateFrom(value);
    }

    setSelectedDateTo(value);
  };

  const handleSelectedEntityChange = (option: EntityOptions | undefined) => {
    if (option?.value) setSearchParams({ entity: option.value });
  };

  const handleTraceClick = (id: string) => {
    if (id === selectedTraceId) {
      return setSelectedTraceId(undefined);
    }
    setSelectedTraceId(id);
    setDialogIsOpen(true);
  };

  const error = isTracesError ? parseError(TracesError) : undefined;

  const orderedTraceEntries = useMemo(() => {
    if (!groupByThread) {
      return traces.map(item => ({ id: item.traceId }));
    }
    const { groups, ungrouped } = groupTracesByThread(traces);
    const ordered: { id: string }[] = [];
    for (const group of groups) {
      for (const trace of group.traces) {
        ordered.push({ id: trace.traceId });
      }
    }
    for (const trace of ungrouped) {
      ordered.push({ id: trace.traceId });
    }
    return ordered;
  }, [traces, groupByThread]);

  // 403 check - permission denied for traces
  if (TracesError && is403ForbiddenError(TracesError)) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <EyeIcon />
            </Icon>
            Observability
          </HeaderTitle>

          <HeaderAction>
            <Button
              as={Link}
              to="https://mastra.ai/en/docs/observability/tracing/overview"
              target="_blank"
              variant="ghost"
              size="md"
            >
              <DocsIcon />
              Observability documentation
            </Button>
          </HeaderAction>
        </Header>

        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="traces" />
        </div>
      </MainContentLayout>
    );
  }

  const filtersApplied = selectedEntityOption?.value !== 'all' || selectedDateFrom || selectedDateTo;

  const toNextTrace = getToNextEntryFn({
    entries: orderedTraceEntries,
    id: selectedTraceId,
    update: setSelectedTraceId,
  });
  const toPreviousTrace = getToPreviousEntryFn({
    entries: orderedTraceEntries,
    id: selectedTraceId,
    update: setSelectedTraceId,
  });

  return (
    <>
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <EyeIcon />
            </Icon>
            Observability
          </HeaderTitle>

          <HeaderAction>
            <Button
              as={Link}
              to="https://mastra.ai/en/docs/observability/tracing/overview"
              target="_blank"
              variant="ghost"
              size="md"
            >
              <DocsIcon />
              Observability documentation
            </Button>
          </HeaderAction>
        </Header>

        <div className={cn(`grid overflow-y-auto h-full`)}>
          <div className={cn('max-w-[100rem] px-12 mx-auto grid content-start gap-8 h-full')}>
            <PageHeader
              title="Observability"
              description="Explore observability traces for your entities"
              icon={<EyeIcon />}
            />

            <TracesTools
              onEntityChange={handleSelectedEntityChange}
              onReset={handleReset}
              selectedEntity={selectedEntityOption}
              entityOptions={entityOptions}
              onDateChange={handleDataChange}
              selectedDateFrom={selectedDateFrom}
              selectedDateTo={selectedDateTo}
              isLoading={isTracesLoading || isLoadingAgents || isLoadingWorkflows}
              groupByThread={groupByThread}
              onGroupByThreadChange={setGroupByThread}
            />

            {isTracesLoading ? (
              <EntryListSkeleton columns={tracesListColumns} />
            ) : (
              <TracesList
                traces={traces}
                selectedTraceId={selectedTraceId}
                onTraceClick={handleTraceClick}
                errorMsg={error?.error}
                setEndOfListElement={setEndOfListElement}
                filtersApplied={Boolean(filtersApplied)}
                isFetchingNextPage={isFetchingNextPage}
                hasNextPage={hasNextPage}
                groupByThread={groupByThread}
                threadTitles={threadTitles}
              />
            )}
          </div>
        </div>
      </MainContentLayout>
      <TraceDialog
        traceSpans={Trace?.spans}
        traceId={selectedTraceId}
        initialSpanId={spanId || undefined}
        initialSpanTab={spanTab === 'scores' ? 'scores' : 'details'}
        initialScoreId={scoreId || undefined}
        traceDetails={traces.find(t => t.traceId === selectedTraceId)}
        isOpen={dialogIsOpen}
        onClose={() => {
          void navigate(`/observability`);
          setDialogIsOpen(false);
        }}
        onNext={toNextTrace}
        onPrevious={toPreviousTrace}
        isLoadingSpans={isLoadingTrace}
        computeTraceLink={(traceId, spanId) => `/observability?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`}
        scorers={scorers}
        isLoadingScorers={isLoadingScorers}
      />
    </>
  );
}
