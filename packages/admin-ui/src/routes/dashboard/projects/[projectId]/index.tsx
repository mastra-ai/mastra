import { useParams, Link } from 'react-router';
import { useProject } from '@/hooks/projects/use-project';
import { Settings, Key, Rocket, Activity } from 'lucide-react';

export function ProjectOverview() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useProject(projectId!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 bg-surface2 rounded-lg border border-border text-center">
        <p className="text-neutral6">Project not found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral9">{project.name}</h1>
          <p className="text-sm text-neutral6">{project.slug}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link
          to={`/projects/${projectId}/deployments`}
          className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
        >
          <Rocket className="h-8 w-8 text-accent1 mb-3" />
          <h3 className="text-lg font-medium text-neutral9">Deployments</h3>
          <p className="text-sm text-neutral6 mt-1">Manage deployments</p>
        </Link>

        <Link
          to={`/projects/${projectId}/env-vars`}
          className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
        >
          <Key className="h-8 w-8 text-accent1 mb-3" />
          <h3 className="text-lg font-medium text-neutral9">Environment</h3>
          <p className="text-sm text-neutral6 mt-1">Environment variables</p>
        </Link>

        <Link
          to={`/projects/${projectId}/observability`}
          className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
        >
          <Activity className="h-8 w-8 text-accent1 mb-3" />
          <h3 className="text-lg font-medium text-neutral9">Observability</h3>
          <p className="text-sm text-neutral6 mt-1">Traces, logs, and metrics</p>
        </Link>

        <Link
          to={`/projects/${projectId}/settings`}
          className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
        >
          <Settings className="h-8 w-8 text-accent1 mb-3" />
          <h3 className="text-lg font-medium text-neutral9">Settings</h3>
          <p className="text-sm text-neutral6 mt-1">Project configuration</p>
        </Link>
      </div>
    </div>
  );
}
