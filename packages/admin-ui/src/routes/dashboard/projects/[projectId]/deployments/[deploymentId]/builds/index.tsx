import { useParams, Link } from 'react-router';
import { useBuilds } from '@/hooks/builds/use-builds';

export function BuildsPage() {
  const { projectId, deploymentId } = useParams<{ projectId: string; deploymentId: string }>();
  const { data: builds, isLoading } = useBuilds(deploymentId!);

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
        <h1 className="text-2xl font-semibold text-neutral9">Builds</h1>
      </div>

      {builds?.data && builds.data.length > 0 ? (
        <div className="space-y-2">
          {builds.data.map(build => (
            <Link
              key={build.id}
              to={`/projects/${projectId}/deployments/${deploymentId}/builds/${build.id}`}
              className="block p-4 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral9">Build {build.id.slice(0, 8)}</span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    build.status === 'succeeded'
                      ? 'bg-green-500/10 text-green-500'
                      : build.status === 'failed'
                        ? 'bg-red-500/10 text-red-500'
                        : build.status === 'building'
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-neutral3/10 text-neutral3'
                  }`}
                >
                  {build.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-6 bg-surface2 rounded-lg border border-border text-center">
          <p className="text-neutral6">No builds yet</p>
        </div>
      )}
    </div>
  );
}
