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
import { useEffect, useState } from 'react';
import { EyeIcon } from 'lucide-react';
import { useTraces } from '@/domains/observability/hooks/use-traces';
import { useTrace } from '@/domains/observability/hooks/use-trace';

import { Link, useNavigate, useSearchParams } from 'react-router';

enum TraceStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  RUNNING = 'running',
}

export default function Observability() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>();
  const [selectedEntityOption, setSelectedEntityOption] = useState<EntityOptions | undefined>({
    value: 'all',
    label: 'All',
    type: 'all' as const,
  });
  const [selectedType, setSelectedType] = useState<SpanType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<TraceStatus | 'all'>('all');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(undefined);
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);
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
    data: traces = [],
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
      ...(selectedType !== 'all' && {
        spanType: selectedType,
      }),
      ...(selectedStatus !== 'all' && {
        status: selectedStatus as TraceStatus,
      }),
      ...(selectedRunId && {
        runId: selectedRunId,
      }),
    },
  });

  useEffect(() => {
    if (traceId) {
      setSelectedTraceId(traceId);
      setDialogIsOpen(true);
    }
  }, [traceId]);

  const agentOptions: EntityOptions[] = (Object.entries(agents) || []).map(([_, value]) => ({
    value: value.id,
    label: value.name,
    type: EntityType.AGENT,
  }));

  const workflowOptions: EntityOptions[] = (Object.entries(workflows || {}) || []).map(([, value]) => ({
    value: value.name,
    label: value.name,
    type: EntityType.WORKFLOW_RUN,
  }));

  const entityOptions: EntityOptions[] = [
    { value: 'all', label: 'All', type: 'all' as const },
    ...agentOptions,
    ...workflowOptions,
  ];

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

  useEffect(() => {
    if (entityOptions) {
      const entityName = searchParams.get('entity');
      const entityOption = entityOptions.find(option => option.value === entityName);
      if (entityOption && entityOption.value !== selectedEntityOption?.value) {
        setSelectedEntityOption(entityOption);
      }
    }
  }, [searchParams, selectedEntityOption, entityOptions]);

  useEffect(() => {
    const runId = searchParams.get('runId');
    if (runId && !selectedRunId) {
      setSelectedRunId(runId);
    }
  }, [searchParams, selectedRunId]);

  const handleReset = () => {
    setSelectedTraceId(undefined);
    setDialogIsOpen(false);
    setSelectedDateFrom(undefined);
    setSelectedDateTo(undefined);
    setSelectedType('all');
    setSelectedStatus('all');

    setSearchParams({ entity: 'all' });
    // postpone clearing runId to avoid race condition
    setTimeout(() => {
      setSelectedRunId('');
    }, 1);
  };

  const handleLessFilters = () => {
    setSelectedType('all');
    setSelectedStatus('all');

    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('runId');
      return newParams;
    });
    setTimeout(() => {
      setSelectedRunId('');
    }, 1);
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

  const handleStatusChange = (status: any | 'all') => {
    setSelectedStatus(status);
  };

  const handleRunIdChange = (runId: string) => {
    handleReset();
    setSelectedRunId(runId);
  };

  const handleSelectedEntityChange = (option: EntityOptions | undefined) => {
    option?.value && setSearchParams({ entity: option?.value });
  };

  const handleTraceClick = (id: string) => {
    if (id === selectedTraceId) {
      return setSelectedTraceId(undefined);
    }
    setSelectedTraceId(id);
    setDialogIsOpen(true);
  };

  const error = isTracesError ? parseError(TracesError) : undefined;

  const filtersApplied =
    selectedEntityOption?.value !== 'all' ||
    selectedDateFrom ||
    selectedDateTo ||
    selectedStatus !== 'all' ||
    selectedType !== 'all' ||
    !!selectedRunId;

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
              selectedDateFrom={selectedDateFrom}
              selectedDateTo={selectedDateTo}
              onEntityChange={handleSelectedEntityChange}
              onDateChange={handleDataChange}
              onTypeChange={handleSpanTypeChange}
              onStatusChange={handleStatusChange}
              onRunIdChange={handleRunIdChange}
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
          navigate(`/observability`);
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
