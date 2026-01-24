import { useParams } from 'react-router';
import { useMetrics } from '@/hooks/observability/use-metrics';

export function MetricsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: metrics, isLoading } = useMetrics(projectId!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-neutral9">Metrics</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-6 bg-surface2 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-neutral6 mb-2">Total Requests</h3>
          <p className="text-2xl font-semibold text-neutral9">{metrics?.totalRequests?.toLocaleString() || '-'}</p>
        </div>

        <div className="p-6 bg-surface2 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-neutral6 mb-2">Success Rate</h3>
          <p className="text-2xl font-semibold text-green-500">
            {metrics?.successRate ? `${(metrics.successRate * 100).toFixed(1)}%` : '-'}
          </p>
        </div>

        <div className="p-6 bg-surface2 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-neutral6 mb-2">Avg Latency</h3>
          <p className="text-2xl font-semibold text-neutral9">{metrics?.avgLatency ? `${metrics.avgLatency.toFixed(0)}ms` : '-'}</p>
        </div>

        <div className="p-6 bg-surface2 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-neutral6 mb-2">P99 Latency</h3>
          <p className="text-2xl font-semibold text-neutral9">{metrics?.p99Latency ? `${metrics.p99Latency.toFixed(0)}ms` : '-'}</p>
        </div>
      </div>

      <div className="mt-6 p-6 bg-surface2 rounded-lg border border-border text-center">
        <p className="text-neutral6">Detailed metrics charts will be implemented in a future update.</p>
      </div>
    </div>
  );
}
