import { useParams } from 'react-router';
import { useBuild, useBuildLogsQuery } from '@/hooks/builds/use-build';
import { useBuildLogs } from '@/hooks/builds/use-build-logs';

export function BuildLogs() {
  const { buildId } = useParams<{ buildId: string }>();
  const { data: build, isLoading: buildLoading } = useBuild(buildId!);
  const { data: initialLogsData } = useBuildLogsQuery(buildId!);
  const { logs, status } = useBuildLogs(buildId, initialLogsData?.logs);

  if (buildLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1" />
      </div>
    );
  }

  if (!build) {
    return (
      <div className="p-6 bg-surface2 rounded-lg border border-border text-center">
        <p className="text-neutral6">Build not found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral9">Build {build.id.slice(0, 8)}</h1>
          <p className="text-sm text-neutral6">Build logs</p>
        </div>
        <span
          className={`px-3 py-1 text-sm font-medium rounded ${
            (status || build.status) === 'succeeded'
              ? 'bg-green-500/10 text-green-500'
              : (status || build.status) === 'failed'
                ? 'bg-red-500/10 text-red-500'
                : (status || build.status) === 'building'
                  ? 'bg-blue-500/10 text-blue-500'
                  : 'bg-neutral3/10 text-neutral3'
          }`}
        >
          {status || build.status}
        </span>
      </div>

      <div className="bg-surface2 rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-medium text-neutral6">Logs</h2>
        </div>
        <div className="p-4 font-mono text-sm bg-black max-h-[600px] overflow-auto">
          {logs.length > 0 ? (
            logs.map((line, index) => (
              <div key={index} className="text-neutral6 whitespace-pre-wrap">
                {line}
              </div>
            ))
          ) : (
            <div className="text-neutral6">Waiting for logs...</div>
          )}
        </div>
      </div>
    </div>
  );
}
