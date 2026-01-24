import { useParams } from 'react-router';
import { useLogs } from '@/hooks/observability/use-logs';

export function LogsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: logs, isLoading } = useLogs(projectId!);

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
        <h1 className="text-2xl font-semibold text-neutral9">Logs</h1>
      </div>

      <div className="bg-surface2 rounded-lg border border-border overflow-hidden">
        <div className="p-4 font-mono text-sm bg-black max-h-[600px] overflow-auto">
          {logs?.data && logs.data.length > 0 ? (
            logs.data.map((log, index) => (
              <div key={index} className="py-1 flex">
                <span className="text-neutral3 w-48 flex-shrink-0">{new Date(log.timestamp).toLocaleString()}</span>
                <span
                  className={`w-16 flex-shrink-0 ${
                    log.level === 'error'
                      ? 'text-red-500'
                      : log.level === 'warn'
                        ? 'text-yellow-500'
                        : log.level === 'info'
                          ? 'text-blue-500'
                          : 'text-neutral6'
                  }`}
                >
                  {log.level.toUpperCase()}
                </span>
                <span className="text-neutral9 whitespace-pre-wrap">{log.message}</span>
              </div>
            ))
          ) : (
            <div className="text-neutral6 py-8 text-center">No logs yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
