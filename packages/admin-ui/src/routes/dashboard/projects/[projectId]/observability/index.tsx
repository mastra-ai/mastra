import { useParams, Link } from 'react-router';
import { Activity, FileText, BarChart3 } from 'lucide-react';

export function ObservabilityDashboard() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral9 mb-6">Observability</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          to={`/projects/${projectId}/observability/traces`}
          className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
        >
          <Activity className="h-8 w-8 text-accent1 mb-3" />
          <h3 className="text-lg font-medium text-neutral9">Traces</h3>
          <p className="text-sm text-neutral6 mt-1">View distributed traces</p>
        </Link>

        <Link
          to={`/projects/${projectId}/observability/logs`}
          className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
        >
          <FileText className="h-8 w-8 text-accent1 mb-3" />
          <h3 className="text-lg font-medium text-neutral9">Logs</h3>
          <p className="text-sm text-neutral6 mt-1">Search and filter logs</p>
        </Link>

        <Link
          to={`/projects/${projectId}/observability/metrics`}
          className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
        >
          <BarChart3 className="h-8 w-8 text-accent1 mb-3" />
          <h3 className="text-lg font-medium text-neutral9">Metrics</h3>
          <p className="text-sm text-neutral6 mt-1">Performance metrics</p>
        </Link>
      </div>
    </div>
  );
}
