import type { DatasetRun, DatasetRunResultWithInput } from '@mastra/client-js';
import { Badge } from '@/ds/components/Badge';
import { Skeleton } from '@/ds/components/Skeleton';

export type RunSummaryProps = {
  run: DatasetRun | undefined;
  results: DatasetRunResultWithInput[];
  isLoading: boolean;
};

export function RunSummary({ run, results, isLoading }: RunSummaryProps) {
  if (isLoading || !run) {
    return <RunSummarySkeleton />;
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const passRate = results.length > 0 ? (successCount / results.length) * 100 : 0;

  const durations = results.map(r => r.durationMs).filter((d): d is number => d !== undefined);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const statusVariants: Record<DatasetRun['status'], 'default' | 'success' | 'error' | 'info'> = {
    pending: 'default',
    running: 'info',
    completed: 'success',
    failed: 'error',
  };

  return (
    <div className="border border-border1 rounded-lg p-4 bg-surface2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-text-default">{run.name || `Run ${run.id.slice(0, 8)}`}</h2>
          {run.targetId && (
            <p className="text-sm text-text-muted">
              Target: {run.targetType.toLowerCase()} / {run.targetId}
            </p>
          )}
        </div>
        <Badge variant={statusVariants[run.status]}>{run.status}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pass Rate" value={`${passRate.toFixed(1)}%`} />
        <StatCard label="Success" value={successCount.toString()} variant="success" />
        <StatCard label="Errors" value={errorCount.toString()} variant={errorCount > 0 ? 'error' : 'default'} />
        <StatCard label="Avg Duration" value={formatDuration(avgDuration)} />
      </div>

      <div className="mt-4 text-xs text-text-muted">
        <span>
          Items: {run.completedCount}/{run.itemCount}
        </span>
        {run.completedAt && <span className="ml-4">Completed: {new Date(run.completedAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  variant?: 'default' | 'success' | 'error';
};

function StatCard({ label, value, variant = 'default' }: StatCardProps) {
  const valueColors = {
    default: 'text-text-default',
    success: 'text-green-500',
    error: 'text-red-500',
  };

  return (
    <div className="bg-surface3 rounded-md p-3">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className={`text-xl font-semibold ${valueColors[variant]}`}>{value}</div>
    </div>
  );
}

const RunSummarySkeleton = () => (
  <div className="border border-border1 rounded-lg p-4 bg-surface2">
    <div className="flex items-center justify-between mb-4">
      <div>
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-surface3 rounded-md p-3">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  </div>
);
