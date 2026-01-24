import { useParams } from 'react-router';
import { useTraces } from '@/hooks/observability/use-traces';

export function TracesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: traces, isLoading } = useTraces(projectId!);

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
        <h1 className="text-2xl font-semibold text-neutral9">Traces</h1>
      </div>

      <div className="bg-surface2 rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Trace ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Duration</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Time</th>
            </tr>
          </thead>
          <tbody>
            {traces?.data && traces.data.length > 0 ? (
              traces.data.map(trace => (
                <tr key={trace.traceId} className="border-b border-border last:border-0 hover:bg-surface3 cursor-pointer">
                  <td className="px-4 py-3 text-sm font-mono text-neutral9">{trace.traceId.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm text-neutral9">{trace.name}</td>
                  <td className="px-4 py-3 text-sm text-neutral6">{trace.durationMs ?? '-'}ms</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        trace.status === 'ok' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {trace.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral6">{new Date(trace.startTime).toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral6">
                  No traces yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
