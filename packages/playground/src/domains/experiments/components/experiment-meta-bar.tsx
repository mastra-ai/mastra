import type { DatasetExperiment } from '@mastra/client-js';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { format, formatDistanceToNow } from 'date-fns';
import { ExternalLinkIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { useLinkComponent } from '@/lib/framework';

export interface ExperimentMetaBarProps {
  experiment: DatasetExperiment;
  className?: string;
}

function MetaCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 px-6 py-3">
      <div className="text-ui-sm text-neutral2 tracking-widest uppercase">{label}</div>
      <div className="text-ui-md text-neutral5 mt-1 flex flex-wrap items-baseline gap-x-1.5">{children}</div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

/**
 * Horizontal metadata strip for the experiment page — Results / Started /
 * Duration / Dataset cells separated by vertical borders.
 */
export function ExperimentMetaBar({ experiment, className }: ExperimentMetaBarProps) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const { data: dataset, isLoading: isDatasetLoading } = useDataset(experiment.datasetId ?? '');

  const startedAt = experiment.startedAt ?? experiment.createdAt;
  const startedDate = startedAt ? new Date(startedAt) : null;

  const durationValue = (() => {
    if (experiment.status === 'running') return 'Running…';
    if (!experiment.startedAt || !experiment.completedAt) return '—';
    const ms = new Date(experiment.completedAt).getTime() - new Date(experiment.startedAt).getTime();
    if (ms < 0) return '—';
    return formatDuration(ms);
  })();

  return (
    <div className={cn('flex w-full items-stretch divide-x divide-border1 border-y border-border1', className)}>
      <MetaCell label="Results">
        <span className="font-mono">
          <span className={cn((experiment.failedCount ?? 0) > 0 ? 'text-error' : 'text-accent1')}>
            {experiment.failedCount ?? 0}
          </span>
          <span className="text-neutral3">/{experiment.totalItems}</span>
        </span>
        <span>failed</span>
      </MetaCell>

      <MetaCell label="Started">
        {startedDate ? (
          <>
            <span>{format(startedDate, 'MMM d, h:mm a')}</span>
            <span className="text-neutral3">· {formatDistanceToNow(startedDate, { addSuffix: true })}</span>
          </>
        ) : (
          <span>—</span>
        )}
      </MetaCell>

      <MetaCell label="Duration">
        <span>{durationValue}</span>
      </MetaCell>

      <MetaCell label="Dataset">
        {experiment.datasetId ? (
          isDatasetLoading ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <>
              <LinkComponent
                href={paths.datasetLink(experiment.datasetId)}
                target="_blank"
                rel="noopener noreferrer"
                className="[&>svg]:text-neutral3 flex min-w-0 items-center gap-1.5 hover:underline [&>svg]:size-3.5 [&>svg]:shrink-0"
              >
                <span className="truncate">{dataset?.name ?? experiment.datasetId}</span>
                <ExternalLinkIcon />
              </LinkComponent>
              {experiment.datasetVersion != null && (
                <span className="text-neutral3 shrink-0">v{experiment.datasetVersion}</span>
              )}
              <span className="text-neutral3 shrink-0">
                · {experiment.totalItems} item{experiment.totalItems === 1 ? '' : 's'}
              </span>
            </>
          )
        ) : (
          <span>—</span>
        )}
      </MetaCell>
    </div>
  );
}
