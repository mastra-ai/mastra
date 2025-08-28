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
import { AISpanRecord } from '@mastra/core';

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
  const [selectedTrace, setSelectedTrace] = useState<AISpanRecord | undefined>();
  const [selectedEntity, setSelectedEntity] = useState<string | undefined>(undefined);
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | null | undefined>(undefined);
  const [selectedDateTo, setSelectedDateTo] = useState<Date | null | undefined>(undefined);
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const { data: agents } = useAgents();

  // const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const entities = [
    ...(Object.entries(agents) || []).map(([key, value]) => ({ id: key, name: value.name, type: 'agent' })),
  ];

  const entityOptions = entities.map(entity => ({ value: entity.id, label: entity.name }));
  const handleReset = () => {
    setSelectedTrace(undefined);
    setSelectedEntity('');
    setDialogIsOpen(false);
    setSelectedDateFrom(undefined);
    setSelectedDateTo(undefined);
  };
  const handleEntityChange = (value: string) => {
    setSelectedEntity(value || '');
  };
  const handleDataChange = (value: Date | null | undefined, type: 'from' | 'to') => {
    if (type === 'from') {
      setSelectedDateFrom(value);
    } else {
      setSelectedDateTo(value);
    }
  };

  const events: EventType[] = aiTraces.map(trace => ({
    id: trace.traceId,
    date: trace.createdAt,
    time: trace.createdAt,
    entityName: trace.name,
  }));

  const handleOnListItem = (id: string) => {
    if (id === selectedTrace?.traceId) {
      return setSelectedTrace(undefined);
    }

    const item = aiTraces.find(item => item.traceId === id);

    if (!item) {
      return console.warn('Item not found for id:', id);
    }

    setSelectedTrace(item);
    setDialogIsOpen(true);
  };
  const toPreviousItem = (currentEvent: any) => {
    const currentIndex = aiTraces?.findIndex(event => event?.traceId === currentEvent?.traceId);
    if (currentIndex === -1 || currentIndex === (events?.length || 0) - 1) {
      return null; // No next event
    }
    return () => setSelectedTrace(aiTraces[(currentIndex || 0) + 1]);
  };
  const toNextItem = (currentEvent: any) => {
    const currentIndex = aiTraces?.findIndex(event => event?.traceId === currentEvent?.traceId);
    if ((currentIndex || 0) <= 0) {
      return null; // No previous event
    }
    return () => setSelectedTrace(aiTraces[(currentIndex || 0) - 1]);
  };

  return (
    <>
      <MainContentLayout>
        <Header>
          <HeaderTitle>Observability</HeaderTitle>
        </Header>
        <div className={cn(`h-full overflow-y-scroll `)}>
          <div className={cn('max-w-[100rem] px-[3rem] mx-auto grid gap-[2rem]')}>
            <PageHeader title="Observability" description="View and manage observability events." icon={<EyeIcon />} />
            <ObservabilityTracesTools
              onEntityChange={handleEntityChange}
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
                selectedItem={selectedTrace}
                onItemClick={handleOnListItem}
                columns={listColumns}
                isLoading={false}
              />
            )}
          </div>
        </div>
      </MainContentLayout>
      <TraceDialog
        parentTraceId={selectedTrace?.traceId}
        isOpen={dialogIsOpen}
        onClose={() => setDialogIsOpen(false)}
        onNext={toNextItem(selectedTrace)}
        onPrevious={toPreviousItem(selectedTrace)}
      />
    </>
  );
}
