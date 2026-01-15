import { EntryList } from '@/ds/components/EntryList';
import { getShortId } from '@/ds/components/Text';
import { Badge } from '@/ds/components/Badge';
import type { AuditEvent } from '@mastra/client-js';
import { format, isToday } from 'date-fns';

export const auditLogsListColumns = [
  { name: 'time', label: 'Time', size: '8rem' },
  { name: 'actor', label: 'Actor', size: '12rem' },
  { name: 'action', label: 'Action', size: '1fr' },
  { name: 'resource', label: 'Resource', size: '10rem' },
  { name: 'outcome', label: 'Outcome', size: '5rem' },
];

export type AuditLogsListProps = {
  events?: AuditEvent[];
  selectedEventId?: string;
  onEventClick?: (id: string) => void;
  errorMsg?: string;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  filtersApplied?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
};

function OutcomeBadge({ outcome }: { outcome: AuditEvent['outcome'] }) {
  const variants: Record<AuditEvent['outcome'], 'default' | 'info' | 'error'> = {
    success: 'default',
    failure: 'error',
    denied: 'info',
  };

  return <Badge variant={variants[outcome]}>{outcome}</Badge>;
}

export function AuditLogsList({
  events,
  selectedEventId,
  onEventClick,
  errorMsg,
  setEndOfListElement,
  filtersApplied,
  isFetchingNextPage,
  hasNextPage,
}: AuditLogsListProps) {
  if (!events) {
    return null;
  }

  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={auditLogsListColumns} />
        {errorMsg ? (
          <EntryList.Message message={errorMsg} type="error" />
        ) : (
          <>
            {events.length > 0 ? (
              <EntryList.Entries>
                {events.map(event => {
                  const createdAtDate = new Date(event.createdAt);
                  const isTodayDate = isToday(createdAtDate);

                  const entry = {
                    id: event.id,
                    time: isTodayDate ? format(createdAtDate, 'h:mm:ss aaa') : format(createdAtDate, 'MMM dd h:mm aaa'),
                    actor: event.actor.email || `${event.actor.type}:${getShortId(event.actor.id)}`,
                    action: event.action,
                    resource: event.resource
                      ? `${event.resource.type}:${event.resource.name || getShortId(event.resource.id)}`
                      : '-',
                    outcome: event.outcome,
                  };

                  return (
                    <EntryList.Entry
                      key={entry.id}
                      entry={entry}
                      isSelected={selectedEventId === event.id}
                      columns={auditLogsListColumns}
                      onClick={onEventClick}
                    >
                      {auditLogsListColumns.map((col, index) => {
                        const key = `${index}-${event.id}`;
                        if (col.name === 'outcome') {
                          return (
                            <EntryList.EntryText key={key}>
                              <OutcomeBadge outcome={entry.outcome} />
                            </EntryList.EntryText>
                          );
                        }
                        return (
                          <EntryList.EntryText key={key}>{entry[col.name as keyof typeof entry]}</EntryList.EntryText>
                        );
                      })}
                    </EntryList.Entry>
                  );
                })}
              </EntryList.Entries>
            ) : (
              <EntryList.Message
                message={filtersApplied ? 'No audit events found for applied filters' : 'No audit events found yet'}
              />
            )}
          </>
        )}
      </EntryList.Trim>
      <EntryList.NextPageLoading
        setEndOfListElement={setEndOfListElement}
        loadingText="Loading more events..."
        noMoreDataText="All events loaded"
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
      />
    </EntryList>
  );
}
