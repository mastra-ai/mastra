'use client';

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { RefreshCwIcon, XCircleIcon, CheckCircleIcon, ClockIcon, AlertCircleIcon, LoaderIcon } from 'lucide-react';

import { Table, Thead, Tbody, Row, Th, Cell, TxtCell } from '@/ds/components/Table';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt';
import { ScrollableContainer } from '@/components/scrollable-container';
import { Searchbar } from '@/components/ui/searchbar';
import { Skeleton } from '@/components/ui/skeleton';

import { useTrainingJobs } from '../hooks/use-training-jobs';
import type { TrainingJob } from '../types';

interface TrainingJobsListProps {
  baseUrl?: string;
  agentId?: string;
  onSelectJob?: (job: TrainingJob) => void;
}

const statusFilters = ['all', 'running', 'succeeded', 'failed', 'cancelled'] as const;

const statusConfig: Record<
  string,
  { variant: 'default' | 'success' | 'error' | 'info'; icon: typeof CheckCircleIcon }
> = {
  pending: { variant: 'default', icon: ClockIcon },
  preparing: { variant: 'info', icon: LoaderIcon },
  running: { variant: 'info', icon: LoaderIcon },
  succeeded: { variant: 'success', icon: CheckCircleIcon },
  failed: { variant: 'error', icon: AlertCircleIcon },
  cancelled: { variant: 'default', icon: XCircleIcon },
};

export function TrainingJobsList({ baseUrl, agentId, onSelectJob }: TrainingJobsListProps) {
  const { jobs, isLoading, error, refresh, cancelJob } = useTrainingJobs({
    baseUrl,
    agentId,
    autoRefresh: true,
    // Faster refresh to catch progress updates
    refreshInterval: 5000,
  });

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredJobs = jobs.filter(job => {
    if (statusFilter !== 'all' && job.status !== statusFilter) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        job.agentName.toLowerCase().includes(query) ||
        job.id.toLowerCase().includes(query) ||
        job.baseModel.toLowerCase().includes(query) ||
        job.fineTunedModelId?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleCancel = async (e: React.MouseEvent, job: TrainingJob) => {
    e.stopPropagation();
    if (confirm(`Cancel training job ${job.id}?`)) {
      try {
        await cancelJob(job.id);
      } catch (err) {
        console.error('Failed to cancel job:', err);
      }
    }
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-accent2 mb-4">{error}</div>
        <Button onClick={refresh}>
          <Icon>
            <RefreshCwIcon />
          </Icon>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="p-5 flex items-center gap-3">
        <div className="flex-1">
          <Searchbar
            onSearch={setSearchQuery}
            label="Search training jobs"
            placeholder="Search by agent, model, or job ID..."
          />
        </div>

        <div className="flex gap-1">
          {statusFilters.map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-ui-sm rounded-md transition-colors ${
                statusFilter === status ? 'bg-surface4 text-icon6' : 'text-icon3 hover:bg-surface3 hover:text-icon5'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <Button onClick={refresh} disabled={isLoading}>
          <Icon className={isLoading ? 'animate-spin' : ''}>
            <RefreshCwIcon />
          </Icon>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Table */}
      {isLoading && jobs.length === 0 ? (
        <TrainingJobsTableSkeleton />
      ) : filteredJobs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-icon3">
          {jobs.length === 0 ? 'No training jobs yet' : 'No jobs match your filters'}
        </div>
      ) : (
        <ScrollableContainer>
          <Table>
            <Thead>
              <Th style={{ width: '15%' }}>Job ID</Th>
              <Th style={{ width: '15%' }}>Agent</Th>
              <Th style={{ width: '8%' }}>Method</Th>
              <Th style={{ width: '20%' }}>Base Model</Th>
              <Th style={{ width: '10%' }}>Status</Th>
              <Th style={{ width: '8%' }}>Examples</Th>
              <Th style={{ width: '14%' }}>Created</Th>
              <Th style={{ width: '10%' }}>Actions</Th>
            </Thead>
            <Tbody>
              {filteredJobs.map(job => {
                const config = statusConfig[job.status] || statusConfig.pending;
                const StatusIcon = config.icon;
                const createdAt = new Date(job.createdAt);

                return (
                  <Row key={job.id} onClick={() => onSelectJob?.(job)}>
                    <Cell>
                      <Txt as="span" variant="ui-md" className="font-mono text-icon6">
                        {job.id.slice(0, 12)}...
                      </Txt>
                    </Cell>
                    <TxtCell>{job.agentName}</TxtCell>
                    <Cell>
                      <Badge>{job.method.toUpperCase()}</Badge>
                    </Cell>
                    <Cell>
                      <Txt as="span" variant="ui-sm" className="font-mono">
                        {job.baseModel}
                      </Txt>
                    </Cell>
                    <Cell>
                      <Badge variant={config.variant} icon={<StatusIcon className="w-3 h-3" />}>
                        {job.providerStatus
                          ? job.providerStatus
                              .split('_')
                              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(' ')
                          : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </Badge>
                    </Cell>
                    <TxtCell>{job.trainingExamples}</TxtCell>
                    <Cell title={format(createdAt, 'PPpp')}>
                      <Txt as="span" variant="ui-md">
                        {formatDistanceToNow(createdAt, { addSuffix: true })}
                      </Txt>
                    </Cell>
                    <Cell>
                      {(job.status === 'pending' || job.status === 'running' || job.status === 'preparing') && (
                        <Button onClick={(e: React.MouseEvent) => handleCancel(e, job)} className="text-accent2">
                          <Icon>
                            <XCircleIcon className="w-4 h-4" />
                          </Icon>
                          Cancel
                        </Button>
                      )}
                    </Cell>
                  </Row>
                );
              })}
            </Tbody>
          </Table>
        </ScrollableContainer>
      )}
    </div>
  );
}

function TrainingJobsTableSkeleton() {
  return (
    <Table>
      <Thead>
        <Th>Job ID</Th>
        <Th>Agent</Th>
        <Th>Method</Th>
        <Th>Base Model</Th>
        <Th>Status</Th>
        <Th>Examples</Th>
        <Th>Created</Th>
        <Th>Actions</Th>
      </Thead>
      <Tbody>
        {Array.from({ length: 5 }).map((_, index) => (
          <Row key={index}>
            <Cell>
              <Skeleton className="h-4 w-24" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-20" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-12" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-32" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-16" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-8" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-20" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-16" />
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
  );
}
