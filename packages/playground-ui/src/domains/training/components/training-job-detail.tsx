'use client';

import { format, formatDistanceToNow } from 'date-fns';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  LoaderIcon,
  CopyIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
} from 'lucide-react';

import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { Skeleton } from '@/components/ui/skeleton';

import { useTrainingJobDetail } from '../hooks/use-training-job-detail';

interface TrainingJobDetailProps {
  baseUrl?: string;
  jobId: string;
  onClose?: () => void;
}

const statusConfig: Record<
  string,
  { variant: 'default' | 'success' | 'error' | 'info'; icon: typeof CheckCircleIcon; label: string }
> = {
  pending: { variant: 'default', icon: ClockIcon, label: 'Pending' },
  preparing: { variant: 'info', icon: LoaderIcon, label: 'Preparing' },
  running: { variant: 'info', icon: LoaderIcon, label: 'Running' },
  succeeded: { variant: 'success', icon: CheckCircleIcon, label: 'Succeeded' },
  failed: { variant: 'error', icon: AlertCircleIcon, label: 'Failed' },
  cancelled: { variant: 'default', icon: XCircleIcon, label: 'Cancelled' },
};

/**
 * Format provider status for display (e.g., "validating_files" -> "Validating Files")
 */
function formatProviderStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function TrainingJobDetail({ baseUrl, jobId, onClose }: TrainingJobDetailProps) {
  const { job, events, checkpoints, isLoading, error, refresh, cancel } = useTrainingJobDetail({
    baseUrl,
    jobId,
    autoRefresh: true,
    // Faster refresh when job is active
    refreshInterval: 3000,
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading && !job) {
    return <TrainingJobDetailSkeleton />;
  }

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

  if (!job) {
    return <div className="p-8 text-center text-icon3">Job not found</div>;
  }

  const config = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const isActive = job.status === 'pending' || job.status === 'running' || job.status === 'preparing';
  const createdAt = new Date(job.createdAt);
  const startedAt = job.startedAt ? new Date(job.startedAt) : null;
  const completedAt = job.completedAt ? new Date(job.completedAt) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-icon6 text-ui-lg font-medium">Training Job</h2>
            <Badge variant={config.variant} icon={<StatusIcon className="w-3 h-3" />}>
              {config.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-icon3 text-ui-sm font-mono">
            {job.id}
            <button
              onClick={() => handleCopy(job.id)}
              className="p-1 hover:bg-surface3 rounded transition-colors"
              title="Copy job ID"
            >
              <CopyIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {isActive && (
            <Button onClick={cancel} className="text-accent2">
              <Icon>
                <XCircleIcon />
              </Icon>
              Cancel
            </Button>
          )}
          <Button onClick={refresh} disabled={isLoading}>
            <Icon className={isLoading ? 'animate-spin' : ''}>
              <RefreshCwIcon />
            </Icon>
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard label="Agent" value={job.agentName} />
        <InfoCard label="Method" value={job.method.toUpperCase()} />
        <InfoCard label="Base Model" value={job.baseModel} mono />
        <InfoCard label="Training Examples" value={String(job.trainingExamples)} />
      </div>

      {/* Fine-tuned Model */}
      {job.fineTunedModelId && (
        <div className="p-4 rounded-md bg-surface3 border-sm border-accent1">
          <div className="text-icon3 text-ui-sm uppercase mb-2">Fine-tuned Model</div>
          <div className="flex items-center gap-2">
            <code className="text-icon6 font-mono">{job.fineTunedModelId}</code>
            <button
              onClick={() => handleCopy(job.fineTunedModelId!)}
              className="p-1 hover:bg-surface4 rounded transition-colors"
              title="Copy model ID"
            >
              <CopyIcon className="w-4 h-4 text-icon3" />
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {job.error && (
        <div className="p-4 rounded-md bg-surface3 border-sm border-accent2">
          <div className="text-accent2 text-ui-sm uppercase mb-2">Error</div>
          <div className="text-icon6">{job.error}</div>
        </div>
      )}

      {/* Metrics */}
      {job.metrics && (
        <div className="p-4 rounded-md bg-surface2 border-sm border-border1">
          <div className="text-icon3 text-ui-sm uppercase mb-3">Training Metrics</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {job.metrics.trainingLoss !== undefined && (
              <MetricCard label="Training Loss" value={job.metrics.trainingLoss.toFixed(4)} />
            )}
            {job.metrics.validationLoss !== undefined && (
              <MetricCard label="Validation Loss" value={job.metrics.validationLoss.toFixed(4)} />
            )}
            {job.metrics.trainedTokens !== undefined && (
              <MetricCard label="Trained Tokens" value={job.metrics.trainedTokens.toLocaleString()} />
            )}
            {job.metrics.epochs !== undefined && <MetricCard label="Epochs" value={String(job.metrics.epochs)} />}
            {job.metrics.steps !== undefined && <MetricCard label="Steps" value={String(job.metrics.steps)} />}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="p-4 rounded-md bg-surface2 border-sm border-border1">
        <div className="text-icon3 text-ui-sm uppercase mb-3">Timeline</div>
        <div className="space-y-3">
          <TimelineItem label="Created" time={createdAt} />
          {startedAt && <TimelineItem label="Started" time={startedAt} />}
          {completedAt && (
            <TimelineItem
              label={job.status === 'succeeded' ? 'Completed' : job.status === 'failed' ? 'Failed' : 'Ended'}
              time={completedAt}
              isLast
            />
          )}
          {!completedAt && isActive && (
            <ActiveStatusItem status={job.status} providerStatus={job.providerStatus} progress={job.progress} />
          )}
        </div>
      </div>

      {/* Checkpoints */}
      {checkpoints && checkpoints.length > 0 && (
        <div className="p-4 rounded-md bg-surface2 border-sm border-border1">
          <div className="text-icon3 text-ui-sm uppercase mb-3">Checkpoints</div>
          <div className="space-y-2">
            {checkpoints.map(cp => (
              <div key={cp.id} className="flex items-center justify-between p-3 rounded-md bg-surface3">
                <div>
                  <span className="text-ui-md font-medium text-icon6">Step {cp.step}</span>
                  <span className="text-ui-sm text-icon3 ml-2 font-mono">
                    {cp.model.length > 30 ? `${cp.model.slice(0, 30)}...` : cp.model}
                  </span>
                </div>
                {cp.metrics.trainingLoss && (
                  <span className="text-ui-sm text-icon3">Loss: {cp.metrics.trainingLoss.toFixed(4)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events/Logs */}
      {events && events.length > 0 && (
        <div className="p-4 rounded-md bg-surface2 border-sm border-border1">
          <div className="text-icon3 text-ui-sm uppercase mb-3">Event Log</div>
          <div className="space-y-2 font-mono text-ui-sm max-h-64 overflow-y-auto">
            {events.map((event, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  event.level === 'error' ? 'text-accent2' : event.level === 'warn' ? 'text-accent3' : 'text-icon3'
                }`}
              >
                <span className="text-icon3 shrink-0">{format(new Date(event.time), 'HH:mm:ss')}</span>
                <span>{event.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="p-3 rounded-md bg-surface2 border-sm border-border1">
      <div className="text-icon3 text-ui-sm uppercase mb-1">{label}</div>
      <div className={`text-icon6 ${mono ? 'font-mono text-ui-sm' : ''}`}>{value}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-icon3 text-ui-sm">{label}</div>
      <div className="text-icon6 font-mono">{value}</div>
    </div>
  );
}

function TimelineItem({ label, time, isLast }: { label: string; time: Date; isLast?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className="w-2 h-2 rounded-full bg-accent1" />
        {!isLast && <div className="w-px h-6 bg-border1 mt-1" />}
      </div>
      <div className="flex-1 -mt-1">
        <div className="text-icon6 text-ui-sm">{label}</div>
        <div className="text-icon3 text-ui-sm" title={format(time, 'PPpp')}>
          {formatDistanceToNow(time, { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}

function ActiveStatusItem({
  status,
  providerStatus,
  progress,
}: {
  status: string;
  providerStatus?: string;
  progress?: { stage: string; stageLabel: string; current: number; total: number; percentage: number };
}) {
  // Determine the display status - prefer providerStatus if available
  let displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
  if (providerStatus) {
    displayStatus = formatProviderStatus(providerStatus);
  }

  // If we have progress info, use its label
  const progressLabel = progress?.stageLabel;

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className="w-2 h-2 rounded-full bg-accent1 animate-pulse" />
      </div>
      <div className="flex-1 -mt-1">
        <div className="text-icon6 text-ui-sm flex items-center gap-2">
          <LoaderIcon className="w-3 h-3 animate-spin" />
          {displayStatus}
        </div>
        {progressLabel && (
          <div className="text-icon3 text-ui-sm mt-1">
            {progressLabel}
            {progress && progress.total > 1 && (
              <span className="ml-1">
                ({progress.current}/{progress.total})
              </span>
            )}
          </div>
        )}
        {progress && (
          <div className="mt-2 w-full max-w-xs">
            <div className="w-full bg-surface3 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-accent1 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrainingJobDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 rounded-md bg-surface2 border-sm border-border1">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      <div className="p-4 rounded-md bg-surface2 border-sm border-border1">
        <Skeleton className="h-3 w-20 mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
