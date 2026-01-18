import { useState } from 'react';
import { Button } from '@/ds/components/Button/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Badge } from '@/ds/components/Badge';
import { EntryList } from '@/ds/components/EntryList';
import { Txt } from '@/ds/components/Txt';
import { useAuditLogs, useExportAuditLogs } from '../hooks/use-audit-logs.js';
import type { AuditEvent, AuditFilter, AuditOutcome, AuditActorType } from '../types.js';
import { format } from 'date-fns';

export interface AuditLogListProps {
  /** Default filter options */
  defaultFilter?: Partial<AuditFilter>;
  /** Items per page (default 50) */
  pageSize?: number;
}

const auditLogColumns = [
  { name: 'timestamp', label: 'Timestamp', size: '11rem' },
  { name: 'outcome', label: 'Outcome', size: '7rem' },
  { name: 'actor', label: 'Actor', size: '10rem' },
  { name: 'action', label: 'Action', size: '1fr' },
  { name: 'resource', label: 'Resource', size: '10rem' },
  { name: 'duration', label: 'Duration', size: '6rem' },
];

/**
 * Audit log list component with filtering and pagination
 *
 * @example
 * ```tsx
 * <AuditLogList defaultFilter={{ outcome: 'failure' }} pageSize={50} />
 * ```
 */
export function AuditLogList({ defaultFilter, pageSize = 50 }: AuditLogListProps) {
  const [filter, setFilter] = useState<AuditFilter>({
    limit: pageSize,
    offset: 0,
    ...defaultFilter,
  });

  const { data, isLoading, error } = useAuditLogs(filter);
  const exportLogs = useExportAuditLogs();
  const [exporting, setExporting] = useState(false);

  const handleFilterChange = (key: keyof AuditFilter, value: any) => {
    setFilter(prev => ({ ...prev, [key]: value, offset: 0 }));
  };

  const handlePageChange = (page: number) => {
    setFilter(prev => ({ ...prev, offset: page * pageSize }));
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      await exportLogs({ ...filter, format });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  const currentPage = Math.floor((filter.offset || 0) / pageSize);
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const events = data?.events || [];

  const entries = events.map(event => {
    const outcomeColor =
      event.outcome === 'success'
        ? 'green'
        : event.outcome === 'failure'
          ? 'red'
          : event.outcome === 'denied'
            ? 'yellow'
            : 'gray';

    return {
      id: event.id,
      timestamp: format(new Date(event.timestamp), 'MMM dd, h:mm:ss aaa'),
      outcome: <Badge variant={outcomeColor as any}>{event.outcome}</Badge>,
      actor: event.actor.email || event.actor.id,
      action: event.action,
      resource: event.resource ? event.resource.name || event.resource.id : '—',
      duration: event.duration !== undefined ? `${event.duration}ms` : '—',
    };
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={filter.outcome || 'all'}
          onValueChange={value => handleFilterChange('outcome', value === 'all' ? undefined : (value as AuditOutcome))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filter.actorType || 'all'}
          onValueChange={value =>
            handleFilterChange('actorType', value === 'all' ? undefined : (value as AuditActorType))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by actor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actors</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="apikey">API Keys</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => handleExport('json')} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export JSON'}
          </Button>
          <Button variant="outline" onClick={() => handleExport('csv')} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Audit log list */}
      <EntryList>
        <EntryList.Trim>
          <EntryList.Header columns={auditLogColumns} />
          {error ? (
            <EntryList.Message message="Error loading audit logs" type="error" />
          ) : !data || events.length === 0 ? (
            <EntryList.Message message="No audit events found" type="info" />
          ) : (
            <EntryList.Entries>
              {entries.map(entry => (
                <EntryList.Entry key={entry.id} entry={entry} columns={auditLogColumns} />
              ))}
            </EntryList.Entries>
          )}
        </EntryList.Trim>

        {data && data.total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border1">
            <Txt>
              Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, data.total)} of {data.total}
            </Txt>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0}>
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </EntryList>
    </div>
  );
}
