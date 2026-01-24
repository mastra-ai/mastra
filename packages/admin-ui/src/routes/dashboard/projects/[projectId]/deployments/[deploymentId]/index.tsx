import { useParams, Link } from 'react-router';
import { useDeployment } from '@/hooks/deployments/use-deployment';
import { useBuilds } from '@/hooks/builds/use-builds';
import { Play, Square, RotateCcw } from 'lucide-react';

export function DeploymentDetail() {
  const { projectId, deploymentId } = useParams<{ projectId: string; deploymentId: string }>();
  const { data: deployment, isLoading: deploymentLoading } = useDeployment(deploymentId!);
  const { data: builds, isLoading: buildsLoading } = useBuilds(deploymentId!);

  if (deploymentLoading || buildsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="p-6 bg-surface2 rounded-lg border border-border text-center">
        <p className="text-neutral6">Deployment not found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral9">{deployment.slug}</h1>
          <p className="text-sm text-neutral6">{deployment.slug}</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-md hover:bg-green-500/20">
            <Play className="h-4 w-4" />
            Deploy
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-md hover:bg-red-500/20">
            <Square className="h-4 w-4" />
            Stop
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-surface3 text-neutral9 rounded-md hover:bg-surface4">
            <RotateCcw className="h-4 w-4" />
            Restart
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <div className="p-6 bg-surface2 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-neutral6 mb-2">Status</h3>
          <span
            className={`px-2 py-1 text-sm font-medium rounded ${
              deployment.status === 'running'
                ? 'bg-green-500/10 text-green-500'
                : deployment.status === 'stopped'
                  ? 'bg-neutral3/10 text-neutral3'
                  : 'bg-yellow-500/10 text-yellow-500'
            }`}
          >
            {deployment.status}
          </span>
        </div>

        {deployment.publicUrl && (
          <div className="p-6 bg-surface2 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-neutral6 mb-2">Public URL</h3>
            <a href={deployment.publicUrl} target="_blank" rel="noopener noreferrer" className="text-accent1 hover:underline">
              {deployment.publicUrl}
            </a>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-neutral9 mb-4">Recent Builds</h2>
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
    </div>
  );
}
