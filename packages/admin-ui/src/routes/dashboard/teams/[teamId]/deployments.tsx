import { useParams, Link } from 'react-router';
import { Rocket } from 'lucide-react';
import { useProjects } from '@/hooks/projects/use-projects';

export function TeamDeployments() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: projects, isLoading } = useProjects(teamId!);

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
      </div>

      <p className="text-neutral6 mb-6">Select a project to view its deployments.</p>

      {projects?.data && projects.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.data.map(project => (
            <Link
              key={project.id}
              to={`/projects/${project.id}/deployments`}
              className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
            >
              <Rocket className="h-8 w-8 text-accent1 mb-3" />
              <h3 className="text-lg font-medium text-neutral9">{project.name}</h3>
              <p className="text-sm text-neutral6 mt-1">View deployments</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-6 bg-surface2 rounded-lg border border-border text-center">
          <p className="text-neutral6">No projects yet. Create a project first to manage deployments.</p>
          <Link
            to={`/teams/${teamId}/projects/new`}
            className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-accent1 text-white rounded-md hover:bg-accent2"
          >
            Create Project
          </Link>
        </div>
      )}
    </div>
  );
}
