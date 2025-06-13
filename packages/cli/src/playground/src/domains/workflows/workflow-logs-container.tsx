import { useLogsByRunId, useLogTransports } from '@/hooks/use-logs';
import {
  Button,
  EmptyState,
  Header,
  Icon,
  LogsIcon,
  WorkflowLogs,
  LogsFiltersForm,
  LogsFiltersFormInputs,
  generateFromToDate,
} from '@mastra/playground-ui';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSidebar } from '@/components/ui/sidebar';

export interface WorkflowLogsContainerProps {
  runId: string;
}

export const WorkflowLogsContainer = ({ runId }: WorkflowLogsContainerProps) => {
  const [expanded, setExpanded] = useState(true);
  const { open } = useSidebar();
  const { transports, isLoading: isLoadingTransports } = useLogTransports();
  const hasTransport = transports.length > 0;

  const [filters, setFilters] = useState<LogsFiltersFormInputs>({
    logLevel: 'all',
    dateRange: { type: 'none' },
  });

  const { fromDate, toDate } = useMemo(() => generateFromToDate(filters.dateRange), [filters.dateRange]);

  const {
    data: logs = [],
    isLoading,
    setEndOfListElement,
  } = useLogsByRunId(runId, {
    logLevel: filters.logLevel === 'all' ? undefined : filters.logLevel,
    fromDate,
    toDate,
  });

  return (
    <div
      className={clsx(
        'z-20 fixed bg-surface3 border-t-sm border-border1 transition-all duration-300 right-[13px] overflow-hidden rounded-b-lg flex flex-col',
        expanded ? 'translate-y-0 h-1/2 bottom-3' : 'translate-y-[calc(100%-32px)] h-content bottom-5',
        open ? 'left-[173px]' : 'left-14',
      )}
    >
      <Header className="shrink-0">
        <LogsIcon />
        <button
          className="text-left w-full h-full flex items-center justify-between"
          onClick={() => setExpanded(s => !s)}
        >
          Logs
          <Icon>
            <ChevronDown className={clsx('transition-transform text-icon3', expanded ? 'rotate-0' : 'rotate-180')} />
          </Icon>
        </button>
      </Header>

      {expanded ? (
        <div className="flex items-stretch grow min-h-0">
          <LogsFiltersForm value={filters} onChange={setFilters} />

          {hasTransport ? (
            <div className={'overflow-y-auto'}>
              <WorkflowLogs logs={logs ?? []} isLoading={isLoading || isLoadingTransports} />
              <div ref={setEndOfListElement} className="h-20" />
            </div>
          ) : (
            <div className="w-full flex items-center justify-center h-full">
              <EmptyState
                iconSlot={null}
                titleSlot="Log transport not set"
                descriptionSlot="To see logs in the playground, you need to set a log transport at the Mastra config level."
                actionSlot={<Button>See documentation</Button>}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
