import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { useLinkComponent } from '@/lib/framework';
import { StatusBadge } from '@/ds/components/StatusBadge';
import { cn } from '@/lib/utils';

interface RecentExperimentsTableProps {
  experiments: DatasetExperiment[];
  datasets?: DatasetRecord[];
  isLoading: boolean;
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
    case 'pending':
      return 'warning';
    case 'failed':
      return 'error';
    default:
      return 'neutral';
  }
}

function formatDate(dateValue?: string | Date | null) {
  if (!dateValue) return '—';
  const d = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function RecentExperimentsTable({ experiments, datasets, isLoading }: RecentExperimentsTableProps) {
  const { navigate, paths } = useLinkComponent();

  const datasetMap = new Map<string, DatasetRecord>();
  if (datasets) {
    for (const ds of datasets) {
      datasetMap.set(ds.id, ds);
    }
  }

  const recentExperiments = [...experiments]
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 20);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-surface3 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (recentExperiments.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-neutral3 text-ui-sm">
        No experiments have been run yet.
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border1 text-left text-ui-xs text-neutral3 uppercase tracking-wider">
            <th className="px-4 py-2 font-medium">Experiment</th>
            <th className="px-4 py-2 font-medium">Dataset</th>
            <th className="px-4 py-2 font-medium">Target</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium text-right">Items</th>
            <th className="px-4 py-2 font-medium text-right">Succeeded</th>
            <th className="px-4 py-2 font-medium text-right">Failed</th>
            <th className="px-4 py-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {recentExperiments.map(exp => {
            const dataset = exp.datasetId ? datasetMap.get(exp.datasetId) : undefined;
            const successRate = exp.totalItems > 0 ? Math.round((exp.succeededCount / exp.totalItems) * 100) : null;

            return (
              <tr
                key={exp.id}
                className={cn(
                  'border-b border-border1 text-ui-sm cursor-pointer transition-colors',
                  'hover:bg-surface3',
                )}
                onClick={() => {
                  if (exp.datasetId) {
                    navigate(paths.datasetExperimentLink(exp.datasetId, exp.id));
                  }
                }}
              >
                <td className="px-4 py-2.5 font-mono text-neutral4 truncate max-w-[200px]">{exp.id.slice(0, 8)}</td>
                <td className="px-4 py-2.5 text-neutral4">{dataset?.name ?? exp.datasetId?.slice(0, 8) ?? '—'}</td>
                <td className="px-4 py-2.5 text-neutral3">
                  <span className="text-neutral3">{exp.targetType}</span>
                  <span className="text-neutral4 ml-1 font-mono">{exp.targetId.slice(0, 12)}</span>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge variant={getStatusVariant(exp.status)} size="sm" withDot>
                    {exp.status}
                  </StatusBadge>
                </td>
                <td className="px-4 py-2.5 text-right text-neutral4 tabular-nums">{exp.totalItems}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className="text-accent1">{exp.succeededCount}</span>
                  {successRate !== null && (
                    <span className="text-neutral3 ml-1 text-ui-xs">({successRate}%)</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-accent2">{exp.failedCount}</td>
                <td className="px-4 py-2.5 text-neutral3">{formatDate(exp.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
