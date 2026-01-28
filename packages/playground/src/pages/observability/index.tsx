import { cn } from '@/lib/utils';
import {
  HeaderTitle,
  Header,
  MainContentLayout,
  TracesList,
  tracesListColumns,
  PageHeader,
  type EntityOptions,
  type SpanTypeOptions,
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
  useAgents,
  useWorkflows,
  useScorers,
  StatusOptions,
} from '@mastra/playground-ui';
import { EntityType, SpanType } from '@mastra/core/observability';
import { useMemo, useState } from 'react';
import { EyeIcon } from 'lucide-react';
import { useTraces } from '@/domains/observability/hooks/use-traces';
import { useTrace } from '@/domains/observability/hooks/use-trace';

import { Link, useNavigate, useSearchParams } from 'react-router';
import { TraceSpan } from 'node_modules/@mastra/core/dist/storage/domains/observability/types';

enum TraceStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  RUNNING = 'running',
}

export default function Observability() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedType, setSelectedType] = useState<SpanType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<TraceSpan['status'] | 'all'>('all');
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(undefined);
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);
  const { data: agents = {}, isLoading: isLoadingAgents } = useAgents();
  const { data: workflows, isLoading: isLoadingWorkflows } = useWorkflows();
  const { data: scorers = {}, isLoading: isLoadingScorers } = useScorers();

  // Derive values from URL search params (single source of truth)
  const selectedTraceId = searchParams.get('traceId') || undefined;
  const dialogIsOpen = !!selectedTraceId;
  const selectedRunId = searchParams.get('runId') || '';
  const selectedThreadId = searchParams.get('threadId') || '';
  const spanId = searchParams.get('spanId');
  const spanTab = searchParams.get('tab');
  const scoreId = searchParams.get('scoreId');

  const { data: Trace, isLoading: isLoadingTrace } = useTrace(selectedTraceId, { enabled: !!selectedTraceId });

  const entityOptions = useMemo<EntityOptions[]>(() => {
    const agentOpts: EntityOptions[] = Object.values(agents).map(agent => ({
      value: agent.id,
      label: agent.name,
      type: EntityType.AGENT,
    }));
    const workflowOpts: EntityOptions[] = Object.values(workflows || {}).map(wf => ({
      value: wf.name,
      label: wf.name,
      type: EntityType.WORKFLOW_RUN,
    }));
    return [{ value: 'all', label: 'All', type: 'all' as const }, ...agentOpts, ...workflowOpts];
  }, [agents, workflows]);

  const selectedEntityOption = useMemo<EntityOptions>(() => {
    const entityName = searchParams.get('entity');
    if (!entityName || entityName === 'all') {
      return { value: 'all', label: 'All', type: 'all' as const };
    }
    return entityOptions.find(option => option.value === entityName) || { value: 'all', label: 'All', type: 'all' as const };
  }, [searchParams, entityOptions]);

  const {
    data: traces = [],
    isLoading: isTracesLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error: TracesError,
    isError: isTracesError,
  } = useTraces({
    filters: {
      ...(selectedEntityOption.type !== 'all' && {
        entityId: selectedEntityOption.value,
        entityType: selectedEntityOption.type,
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
      ...(selectedType !== 'all' && {
        spanType: selectedType,
      }),
      ...(selectedStatus !== 'all' && {
        status: selectedStatus as TraceStatus,
      }),
      ...(selectedRunId && {
        runId: selectedRunId,
      }),
      ...(selectedThreadId && {
        threadId: selectedThreadId,
      }),
    },
  });

  const spanTypeOptions: SpanTypeOptions[] = [
    { value: 'all', label: 'All' },
    { value: SpanType.AGENT_RUN, label: 'Agent Run' },
    { value: SpanType.WORKFLOW_RUN, label: 'Workflow Run' },
  ];

  const statusOptions: StatusOptions[] = [
    { value: 'all', label: 'All' },
    { value: TraceStatus.SUCCESS, label: 'Success' },
    { value: TraceStatus.ERROR, label: 'Error' },
    { value: TraceStatus.RUNNING, label: 'Running' },
  ];

  const updateTraceId = (id: string) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('traceId', id);
      return params;
    });
  };

  const handleReset = () => {
    setSelectedDateFrom(undefined);
    setSelectedDateTo(undefined);
    setSelectedType('all');
    setSelectedStatus('all');
    setSearchParams({ entity: 'all' });
  };

  const handleLessFilters = () => {
    setSelectedType('all');
    setSelectedStatus('all');
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('runId');
      newParams.delete('threadId');
      return newParams;
    });
  };

  const handleDataChange = (value: Date | undefined, type: 'from' | 'to') => {
    if (type === 'from') {
      return setSelectedDateFrom(value);
    }

    setSelectedDateTo(value);
  };

  const handleSpanTypeChange = (type: SpanType | 'all') => {
    setSelectedType(type);
  };

  const handleStatusChange = (status: TraceSpan['status'] | 'all') => {
    setSelectedStatus(status);
  };

  const handleRunIdChange = (runId: string) => {
    setSelectedDateFrom(undefined);
    setSelectedDateTo(undefined);
    setSelectedType('all');
    setSelectedStatus('all');
    setSearchParams({ entity: 'all', runId });
  };

  const handleThreadIdChange = (threadId: string) => {
    setSelectedDateFrom(undefined);
    setSelectedDateTo(undefined);
    setSelectedType('all');
    setSelectedStatus('all');
    setSearchParams({ entity: 'all', threadId });
  };

  const handleSelectedEntityChange = (option: EntityOptions | undefined) => {
    if (option?.value) {
      setSearchParams({ entity: option.value });
    }
  };

  const handleTraceClick = (id: string) => {
    if (id === selectedTraceId) {
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.delete('traceId');
        return params;
      });
      return;
    }
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('traceId', id);
      return params;
    });
  };

  const error = isTracesError ? parseError(TracesError) : undefined;

  const filtersApplied =
    selectedEntityOption.value !== 'all' ||
    selectedDateFrom ||
    selectedDateTo ||
    selectedStatus !== 'all' ||
    selectedType !== 'all' ||
    !!selectedRunId ||
    !!selectedThreadId;

  const toNextTrace = getToNextEntryFn({
    entries: traces.map(item => ({ id: item.traceId })),
    id: selectedTraceId,
    update: updateTraceId,
  });
  const toPreviousTrace = getToPreviousEntryFn({
    entries: traces.map(item => ({ id: item.traceId })),
    id: selectedTraceId,
    update: updateTraceId,
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
            <Button as={Link} to="https://mastra.ai/en/docs/observability/tracing/overview" target="_blank">
              <Icon>
                <DocsIcon />
              </Icon>
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
              selectedEntity={selectedEntityOption}
              selectedType={selectedType}
              selectedStatus={selectedStatus}
              selectedRunId={selectedRunId}
              selectedThreadId={selectedThreadId}
              selectedDateFrom={selectedDateFrom}
              selectedDateTo={selectedDateTo}
              onEntityChange={handleSelectedEntityChange}
              onDateChange={handleDataChange}
              onTypeChange={handleSpanTypeChange}
              onStatusChange={handleStatusChange}
              onRunIdChange={handleRunIdChange}
              onThreadIdChange={handleThreadIdChange}
              onReset={handleReset}
              onLessFilters={handleLessFilters}
              entityOptions={entityOptions}
              spanTypeOptions={spanTypeOptions}
              statusOptions={statusOptions}
              isLoading={isTracesLoading || isLoadingAgents || isLoadingWorkflows}
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
          navigate('/observability');
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
