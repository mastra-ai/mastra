import { cn } from '@/lib/utils';
import {
  HeaderTitle,
  Header,
  MainContentLayout,
  TracesList,
  tracesListColumns,
  PageHeader,
  EntityOptions,
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
} from '@mastra/playground-ui';
import { useEffect, useState } from 'react';
import { EyeIcon } from 'lucide-react';
import { useTraces } from '@/domains/observability/hooks/use-traces';
import { useTrace } from '@/domains/observability/hooks/use-trace';

import { Link, useNavigate, useSearchParams } from 'react-router';

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
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const { data: agents = {}, isLoading: isLoadingAgents } = useAgents();
  const { data: workflows, isLoading: isLoadingWorkflows } = useWorkflows();

  const { data: Trace, isLoading: isLoadingTrace } = useTrace(selectedTraceId, { enabled: !!selectedTraceId });

  const traceId = searchParams.get('traceId');
  const spanId = searchParams.get('spanId');
  const spanTab = searchParams.get('tab');
  const scoreId = searchParams.get('scoreId');

  const {
    data: Traces = [],
    isLoading: isTracesLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error: TracesError,
    isError: isTracesError,
  } = useTraces({
    filters:
      selectedEntityOption?.type === 'all'
        ? undefined
        : {
            entityId: selectedEntityOption?.value,
            entityType: selectedEntityOption?.type,
          },
    dateRange:
      selectedDateFrom && selectedDateTo
        ? {
            end: selectedDateTo,
            start: selectedDateFrom,
          }
        : undefined,
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
    type: 'agent' as const,
  }));

  const workflowOptions: EntityOptions[] = (Object.entries(workflows || {}) || []).map(([, value]) => ({
    value: value.name,
    label: value.name,
    type: 'workflow' as const,
  }));

  const entityOptions: EntityOptions[] = [
    { value: 'all', label: 'All', type: 'all' as const },
    ...agentOptions,
    ...workflowOptions,
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

  const handleReset = () => {
    setSelectedTraceId(undefined);
    setSearchParams({ entity: 'all', traceId: '' });
    setDialogIsOpen(false);
    setSelectedDateFrom(undefined);
    setSelectedDateTo(undefined);
  };

  const handleDataChange = (value: Date | undefined, type: 'from' | 'to') => {
    if (type === 'from') {
      return setSelectedDateFrom(value);
    }

    setSelectedDateTo(value);
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

  const filtersApplied = selectedEntityOption?.value !== 'all' || selectedDateFrom || selectedDateTo;

  const toNextTrace = getToNextEntryFn({
    entries: Traces.map(item => ({ id: item.traceId })),
    id: selectedTraceId,
    update: setSelectedTraceId,
  });
  const toPreviousTrace = getToPreviousEntryFn({
    entries: Traces.map(item => ({ id: item.traceId })),
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
          <div className={cn('max-w-[100rem] px-[3rem] mx-auto grid content-start gap-[2rem] h-full')}>
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
            />

            {isTracesLoading ? (
              <EntryListSkeleton columns={tracesListColumns} />
            ) : (
              <TracesList
                traces={Traces}
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
        traceDetails={Traces.find(t => t.traceId === selectedTraceId)}
        isOpen={dialogIsOpen}
        onClose={() => {
          navigate(`/observability`);
          setDialogIsOpen(false);
        }}
        onNext={toNextTrace}
        onPrevious={toPreviousTrace}
        isLoadingSpans={isLoadingTrace}
        computeTraceLink={(traceId, spanId) => `/observability?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`}
      />
    </>
  );
}
