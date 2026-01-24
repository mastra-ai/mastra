import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useCreateProject } from '@/hooks/projects/use-create-project';
import { useSources } from '@/hooks/sources/use-sources';
import { SourceType, type ProjectSource } from '@/types/api';
import { Loader2 } from 'lucide-react';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export function NewProjectPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [selectedSource, setSelectedSource] = useState<ProjectSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const { data: sources, isLoading: sourcesLoading } = useSources(teamId!);

  // Auto-populate name and slug from selected source
  useEffect(() => {
    if (selectedSource) {
      setName(selectedSource.name);
      setSlug(generateSlug(selectedSource.name));
    }
  }, [selectedSource]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !selectedSource) return;
    setError(null);

    try {
      const project = await createProject.mutateAsync({
        teamId,
        data: {
          name,
          slug,
          sourceType: selectedSource.type as SourceType,
          sourceConfig: {
            path: selectedSource.path,
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
          <label htmlFor="source" className="block text-sm text-neutral6 mb-1">
            Select Project
          </label>
          {sourcesLoading ? (
            <div className="flex items-center gap-2 text-neutral6 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading available projects...
            </div>
          ) : sources && sources.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sources.map(source => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setSelectedSource(source)}
                  className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                    selectedSource?.id === source.id
                      ? 'border-accent1 bg-accent1/10 text-neutral9'
                      : 'border-border bg-surface3 text-neutral9 hover:border-neutral6'
                  }`}
                >
                  <div className="font-medium">{source.name}</div>
                  <div className="text-xs text-neutral6 truncate">{source.path}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-neutral6 py-2 text-sm">
              No projects found. Make sure your Mastra projects are in the configured source directory.
            </div>
          )}
        </div>

        {selectedSource && (
          <>
            <div>
              <label htmlFor="name" className="block text-sm text-neutral6 mb-1">
                Project Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  setSlug(generateSlug(e.target.value));
                }}
                required
                className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
              />
            </div>
            <div>
              <label htmlFor="slug" className="block text-sm text-neutral6 mb-1">
                Slug
              </label>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
              />
              <p className="mt-1 text-xs text-neutral6">URL-friendly identifier for the project</p>
            </div>
          </>
        )}

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
            disabled={createProject.isPending || !selectedSource}
          >
            {createProject.isPending ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
