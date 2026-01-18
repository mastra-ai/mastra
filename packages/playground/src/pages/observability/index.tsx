import {
  HeaderTitle,
  Header,
  MainContentLayout,
  MainContentContent,
  TracesTable,
  EntityOptions,
  TraceDialog,
  parseError,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  getToNextEntryFn,
  getToPreviousEntryFn,
  useAgents,
  useWorkflows,
  useScorers,
} from '@mastra/playground-ui';
import { EntityType } from '@mastra/core/observability';
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
    entries: traces.map(item => ({ id: item.traceId })),
    id: selectedTraceId,
    update: setSelectedTraceId,
  });
  const toPreviousTrace = getToPreviousEntryFn({
    entries: traces.map(item => ({ id: item.traceId })),
    id: selectedTraceId,
    update: setSelectedTraceId,
  });

  const isEmpty = !isTracesLoading && traces.length === 0;

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

        <MainContentContent isCentered={isEmpty}>
          <TracesTable
            traces={traces}
            isLoading={isTracesLoading || isLoadingAgents || isLoadingWorkflows}
            selectedTraceId={selectedTraceId}
            onTraceClick={handleTraceClick}
            errorMsg={error?.error}
            setEndOfListElement={setEndOfListElement}
            filtersApplied={Boolean(filtersApplied)}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            // Filter props
            selectedEntity={selectedEntityOption}
            entityOptions={entityOptions}
            onEntityChange={handleSelectedEntityChange}
            selectedDateFrom={selectedDateFrom}
            selectedDateTo={selectedDateTo}
            onDateChange={handleDataChange}
            onReset={handleReset}
          />
        </MainContentContent>
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
