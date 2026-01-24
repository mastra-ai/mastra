import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useCreateProject } from '@/hooks/projects/use-create-project';
import { SourceType } from '@/types/api';

export function NewProjectPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [name, setName] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;
    setError(null);

    try {
      const project = await createProject.mutateAsync({
        teamId,
        data: {
          name,
          sourceType: SourceType.LOCAL,
          sourceConfig: {
            path: sourcePath,
          },
        },
      });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-neutral9 mb-6">Create Project</h1>

      {error && <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-md text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm text-neutral6 mb-1">
            Project Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
          />
        </div>

        <div>
          <label htmlFor="sourcePath" className="block text-sm text-neutral6 mb-1">
            Project Path
          </label>
          <input
            id="sourcePath"
            type="text"
            value={sourcePath}
            onChange={e => setSourcePath(e.target.value)}
            placeholder="/path/to/project"
            required
            className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
          />
          <p className="mt-1 text-xs text-neutral6">Absolute path to the Mastra project directory</p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-surface3 text-neutral9 rounded-md hover:bg-surface4"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-accent1 text-white rounded-md hover:bg-accent2 disabled:opacity-50"
            disabled={createProject.isPending}
          >
            {createProject.isPending ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
