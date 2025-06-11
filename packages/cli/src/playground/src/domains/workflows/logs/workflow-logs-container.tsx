import { useLogsByRunId, useLogTransports } from '@/hooks/use-logs';
import { Button, EmptyState, FiltersIcon, Header, Icon, LogsIcon, WorkflowLogs } from '@mastra/playground-ui';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { useLogsFilterForm } from './useLogsFilterForm';
import { FiltersForm } from './LogsForm';
import { addDays } from 'date-fns';

export interface WorkflowLogsContainerProps {
  runId: string;
}

export const WorkflowLogsContainer = ({ runId }: WorkflowLogsContainerProps) => {
  const [expanded, setExpanded] = useState(true);
  const { open } = useSidebar();
  const { transports, isLoading: isLoadingTransports } = useLogTransports();
  const hasTransport = transports.length > 0;

  const [filtersOpen, setFiltersOpen] = useState(false);

  const { watch, control } = useLogsFilterForm();

  const [logLevel, fromDate, toDate] = watch(['logLevel', 'fromDate', 'toDate']);

  const transformedFromDate = fromDate ? new Date(fromDate) : undefined;
  // this needs to be end-inclusive, so we add 1 day
  const transformedToDate = toDate ? addDays(new Date(toDate), 1) : undefined;

  const { data: logs = [], isLoading } = useLogsByRunId(runId, {
    logLevel: logLevel === 'all' ? undefined : logLevel,
    fromDate: transformedFromDate,
    toDate: transformedToDate,
  });

  const hasAnyFilters = logLevel !== 'all' || fromDate !== null || toDate !== null;

  return (
    <div
      className={clsx(
        'z-20 fixed  bg-surface3 border-t-sm border-border1 transition-all duration-300 right-[13px] overflow-hidden rounded-b-lg',
        expanded ? 'translate-y-0 h-1/2 bottom-3' : 'translate-y-[calc(100%-32px)] h-content bottom-5',
        open ? 'left-[173px]' : 'left-14',
      )}
    >
      <Header>
        <LogsIcon />
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <span>Logs</span>
            <Button variant="light" onClick={() => setFiltersOpen(s => !s)}>
              <FiltersIcon className="size-4" />
              Filters
              {hasAnyFilters ? <div className="size-2 bg-blue-500 rounded-full" /> : null}
            </Button>
          </div>
          <button
            className="text-left flex items-center justify-end px-4 py-2 -mx-4"
            onClick={() => setExpanded(s => !s)}
          >
            <Icon>
              <ChevronDown className={clsx('transition-transform text-icon3', expanded ? 'rotate-0' : 'rotate-180')} />
            </Icon>
          </button>
        </div>
      </Header>

      {expanded ? (
        <div className="flex items-stretch h-full">
          {filtersOpen ? <FiltersForm control={control} /> : null}

          {hasTransport ? (
            <div className={'overflow-y-auto h-full'}>
              <WorkflowLogs logs={logs ?? []} isLoading={isLoading || isLoadingTransports} />
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
