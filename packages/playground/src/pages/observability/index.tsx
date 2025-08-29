import { cn } from '@/lib/utils';
import {
  HeaderTitle,
  Header,
  MainContentLayout,
  EntryList,
  ObservabilityTracesTools,
  PageHeader,
  EntityOptions,
} from '@mastra/playground-ui';
import { useState } from 'react';
import { useAgents } from '@/hooks/use-agents';
import { EyeIcon } from 'lucide-react';
import { TraceDialog } from './TraceDialog';
import { useAITraces } from '@/domains/observability/hooks/use-ai-traces';
import { format, isToday } from 'date-fns';
import { useWorkflows } from '@/hooks/use-workflows';

const listColumns = [
  { name: 'id', label: 'ID', size: '16rem' },
  { name: 'date', label: 'Date', size: '5rem' },
  { name: 'time', label: 'Time', size: '5rem' },
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '1fr' },
];

type TraceItem = {
  id: string;
  date: string;
  time: string;
  name: string;
  entityId: string;
};

export default function Observability() {
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>();
  const [selectedEntity, setSelectedEntity] = useState<EntityOptions | undefined>(undefined);
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(undefined);
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const { data: agents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { data: aiTraces = [], isLoading: isLoadingAiTraces } = useAITraces({
    filters:
      selectedEntity?.type === 'all'
        ? undefined
        : {
            entityId: selectedEntity?.value,
            entityType: selectedEntity?.type,
          },
    dateRange:
      selectedDateFrom && selectedDateTo
        ? {
            end: selectedDateTo,
            start: selectedDateFrom,
          }
        : undefined,
  });

  const agentOptions: EntityOptions[] = (Object.entries(agents) || []).map(([key, value]) => ({
    value: value.name,
    label: value.name,
    type: 'agent' as const,
  }));

  const legacy = workflows?.[0] || {};
  const current = workflows?.[1] || {};
  const workflowOptions: EntityOptions[] = (Object.entries({ ...legacy, ...current }) || []).map(([key, value]) => ({
    value: value.name,
    label: value.name,
    type: 'workflow' as const,
  }));

  const entityOptions: EntityOptions[] = [
    { value: 'all', label: 'All', type: 'all' as const },
    ...agentOptions,
    ...workflowOptions,
  ];

  const handleReset = () => {
    setSelectedTraceId(undefined);
    setSelectedEntity(undefined);
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

  const items: TraceItem[] = aiTraces.map(trace => {
    const createdAtDate = new Date(trace.createdAt);
    const isTodayDate = isToday(createdAtDate);

    return {
      id: trace?.traceId,
      date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
      time: format(createdAtDate, 'HH:mm:ss'),
      name: trace?.name,
      entityId: trace?.attributes?.agentId || trace?.attributes?.workflowId,
    };
  });

  const handleOnListItem = (id: string) => {
    if (id === selectedTraceId) {
      return setSelectedTraceId(undefined);
    }

    setSelectedTraceId(id);
    setDialogIsOpen(true);
  };

  const toPreviousItem = () => {
    const currentIndex = aiTraces.findIndex(event => event.traceId === selectedTraceId);
    const prevItem = aiTraces[currentIndex + 1];

    if (prevItem) {
      setSelectedTraceId(prevItem.traceId);
    }
  };

  const toNextItem = () => {
    const currentIndex = aiTraces.findIndex(event => event.traceId === selectedTraceId);
    const nextItem = aiTraces[currentIndex - 1];

    if (nextItem) {
      setSelectedTraceId(nextItem.traceId);
    }
  };

  return (
    <>
      <MainContentLayout>
        <Header>
          <HeaderTitle>Observability</HeaderTitle>
        </Header>

        <div className={cn(`h-full overflow-y-scroll`)}>
          <div className={cn('max-w-[100rem] px-[3rem] mx-auto grid gap-[2rem]')}>
            <PageHeader title="Observability" description="View and manage observability events." icon={<EyeIcon />} />
            <ObservabilityTracesTools
              onEntityChange={setSelectedEntity}
              onReset={handleReset}
              selectedEntity={selectedEntity}
              entityOptions={entityOptions}
              onDateChange={handleDataChange}
              selectedDateFrom={selectedDateFrom}
              selectedDateTo={selectedDateTo}
            />
            {isLoadingAiTraces ? (
              <div>Loading...</div>
            ) : (
              <EntryList
                items={items}
                selectedItemId={selectedTraceId}
                onItemClick={handleOnListItem}
                columns={listColumns}
                isLoading={false}
              />
            )}
          </div>
        </div>
      </MainContentLayout>
      <TraceDialog
        parentTraceId={selectedTraceId}
        isOpen={dialogIsOpen}
        onClose={() => setDialogIsOpen(false)}
        onNext={aiTraces.length > 1 ? toNextItem : undefined}
        onPrevious={aiTraces.length > 1 ? toPreviousItem : undefined}
      />
    </>
  );
}
