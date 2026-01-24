import { useParams, Link } from 'react-router';
import { Plus } from 'lucide-react';
import { useDeployments } from '@/hooks/deployments/use-deployments';

export function DeploymentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: deployments, isLoading } = useDeployments(projectId!);

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
        <h1 className="text-2xl font-semibold text-neutral9">Deployments</h1>
        <Link
          to={`/projects/${projectId}/deployments/new`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent1 text-white rounded-md hover:bg-accent2"
        >
          <Plus className="h-4 w-4" />
          New Deployment
        </Link>
      </div>

      {deployments?.data && deployments.data.length > 0 ? (
        <div className="space-y-4">
          {deployments.data.map(deployment => (
            <Link
              key={deployment.id}
              to={`/projects/${projectId}/deployments/${deployment.id}`}
              className="block p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-neutral9">{deployment.name}</h3>
                  <p className="text-sm text-neutral6 mt-1">{deployment.slug}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
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
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-6 bg-surface2 rounded-lg border border-border text-center">
          <p className="text-neutral6">No deployments yet. Create your first deployment to get started.</p>
        </div>
      )}
    </div>
  );
}
