import { cn } from '@/lib/utils';
import {
  HeaderTitle,
  Header,
  MainContentLayout,
  EntryList,
  ObservabilityTracesTools,
  PageHeader,
} from '@mastra/playground-ui';
import { useState } from 'react';
// import { useWorkflows } from '@/hooks/use-workflows';
import { useAgents } from '@/hooks/use-agents';
import { EyeIcon } from 'lucide-react';
import { TraceDialog } from './TraceDialog';
import { useAITraces } from '@/domains/observability/hooks/use-ai-traces';

const listColumns = [
  { name: 'id', label: 'ID', size: '5rem' },
  { name: 'date', label: 'Date', size: '5rem' },
  { name: 'time', label: 'Time', size: '5rem' },
  { name: 'entityName', label: 'Entity', size: '8rem' },
];

type EventType = {
  id: string;
  date: Date;
  time: Date;
  entityName: string;
};

export default function Observability() {
  const { data: aiTraces = [], isLoading: isLoadingAiTraces } = useAITraces();
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>();
  const [selectedEntity, setSelectedEntity] = useState<string | undefined>(undefined);
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(undefined);
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const { data: agents } = useAgents();

  // const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const entities = [
    ...(Object.entries(agents) || []).map(([key, value]) => ({ id: key, name: value.name, type: 'agent' })),
  ];

  const entityOptions = entities.map(entity => ({ value: entity.id, label: entity.name }));

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

  const events: EventType[] = aiTraces.map(trace => ({
    id: trace.traceId,
    date: trace.createdAt,
    time: trace.createdAt,
    entityName: trace.name,
  }));

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
                items={events}
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
