import { cn } from '@/lib/utils';
import {
  HeaderTitle,
  Header,
  MainContentLayout,
  EntryList,
  PageHeader,
  EntityOptions,
  getShortId,
  EntryListStatusCell,
  TracesTools,
  TraceDialog,
  parseError,
} from '@mastra/playground-ui';
import { useEffect, useState } from 'react';
import { useAgents } from '@/hooks/use-agents';
import { EyeIcon } from 'lucide-react';
import { useAITraces } from '@/domains/observability/hooks/use-ai-traces';
import { useAITrace } from '@/domains/observability/hooks/use-ai-trace';
import { format, isToday } from 'date-fns';
import { useWorkflows } from '@/hooks/use-workflows';
import { useSearchParams } from 'react-router';

const listColumns = [
  { name: 'shortId', label: 'ID', size: '6rem' },
  { name: 'date', label: 'Date', size: '4.5rem' },
  { name: 'time', label: 'Time', size: '6.5rem' },
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '10rem' },
  { name: 'status', label: 'Status', size: '3rem' },
];

type TraceItem = {
  id: string;
  date: string;
  time: string;
  name: string;
  entityId: string;
};

export default function Observability() {
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
  const { data: agents, isLoading: isLoadingAgents } = useAgents();
  const { data: workflows, isLoading: isLoadingWorkflows } = useWorkflows();

  const { data: aiTrace, isLoading: isLoadingAiTrace } = useAITrace(selectedTraceId, { enabled: !!selectedTraceId });

  const {
    data: aiTraces = [],
    isLoading: isLoadingAiTraces,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error: aiTracesError,
    isError: isAiTracesError,
  } = useAITraces({
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

  const agentOptions: EntityOptions[] = (Object.entries(agents) || []).map(([, value]) => ({
    value: value.name,
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
    setSearchParams({ entity: 'all' });
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

  const items: TraceItem[] = aiTraces.map(trace => {
    const createdAtDate = new Date(trace.createdAt);
    const isTodayDate = isToday(createdAtDate);

    return {
      id: trace.traceId,
      shortId: getShortId(trace?.traceId) || 'n/a',
      date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
      time: format(createdAtDate, 'h:mm:ss aaa'),
      name: trace?.name,
      entityId: trace?.attributes?.agentId || trace?.attributes?.workflowId,
      status: <EntryListStatusCell status={trace?.attributes?.status} key={`${trace?.traceId}-status`} />,
    };
  });

  const handleOnListItem = (id: string) => {
    if (id === selectedTraceId) {
      return setSelectedTraceId(undefined);
    }

    setSelectedTraceId(id);
    setDialogIsOpen(true);
  };

  const toNextItem = () => {
    const currentIndex = aiTraces.findIndex(item => item.traceId === selectedTraceId);
    const nextItem = aiTraces[currentIndex + 1];

    if (nextItem) {
      setSelectedTraceId(nextItem.traceId);
    }
  };

  const toPreviousItem = () => {
    const currentIndex = aiTraces.findIndex(item => item.traceId === selectedTraceId);
    const previousItem = aiTraces[currentIndex - 1];

    if (previousItem) {
      setSelectedTraceId(previousItem.traceId);
    }
  };

  const thereIsNextItem = () => {
    const currentIndex = aiTraces.findIndex(item => item.traceId === selectedTraceId);
    return currentIndex < aiTraces.length - 1;
  };

  const thereIsPreviousItem = () => {
    const currentIndex = aiTraces.findIndex(item => item.traceId === selectedTraceId);
    return currentIndex > 0;
  };

  const error = isAiTracesError ? parseError(aiTracesError) : undefined;

  return (
    <>
      <MainContentLayout>
        <Header>
          <HeaderTitle>Observability</HeaderTitle>
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
              isLoading={isLoadingAiTraces || isLoadingAgents || isLoadingWorkflows}
            />
            <EntryList
              items={items}
              selectedItemId={selectedTraceId}
              onItemClick={handleOnListItem}
              columns={listColumns}
              isLoading={isLoadingAiTraces}
              isLoadingNextPage={isFetchingNextPage}
              hasMore={!!hasNextPage}
              setEndOfListElement={setEndOfListElement}
              errorMsg={error?.error}
            />
          </div>
        </div>
      </MainContentLayout>
      <TraceDialog
        traceSpans={aiTrace?.spans}
        traceId={selectedTraceId}
        traceDetails={aiTraces.find(t => t.traceId === selectedTraceId)}
        isOpen={dialogIsOpen}
        onClose={() => setDialogIsOpen(false)}
        onNext={thereIsNextItem() ? toNextItem : undefined}
        onPrevious={thereIsPreviousItem() ? toPreviousItem : undefined}
        isLoadingSpans={isLoadingAiTrace}
      />
    </>
  );
}
