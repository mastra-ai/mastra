import { useParams } from 'react-router';
import { useProject } from '@/hooks/projects/use-project';

export function ProjectSettings() {
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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-neutral9 mb-6">Project Settings</h1>

      <div className="space-y-6">
        <div className="p-6 bg-surface2 rounded-lg border border-border">
          <h2 className="text-lg font-medium text-neutral9 mb-4">General</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral6 mb-1">Project Name</label>
              <input
                type="text"
                defaultValue={project.name}
                className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral6 mb-1">Slug</label>
              <input
                type="text"
                defaultValue={project.slug}
                disabled
                className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral6"
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-surface2 rounded-lg border border-red-500/30">
          <h2 className="text-lg font-medium text-red-500 mb-4">Danger Zone</h2>
          <p className="text-sm text-neutral6 mb-4">
            Once you delete a project, there is no going back. Please be certain.
          </p>
          <button className="px-4 py-2 bg-red-500/10 text-red-500 rounded-md hover:bg-red-500/20">Delete Project</button>
        </div>
      </div>
    </div>
  );
}
