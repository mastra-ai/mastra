import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useCreateDeployment } from '@/hooks/deployments/use-create-deployment';
import { DeploymentType } from '@/types/api';

export function NewDeploymentPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [branch, setBranch] = useState('main');
  const [type, setType] = useState<(typeof DeploymentType)[keyof typeof DeploymentType]>(DeploymentType.PRODUCTION);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const createDeployment = useCreateDeployment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setError(null);

    try {
      const deployment = await createDeployment.mutateAsync({
        projectId,
        data: {
          type,
          branch,
        },
      });
      navigate(`/projects/${projectId}/deployments/${deployment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deployment');
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-neutral9 mb-6">Create Deployment</h1>

      {error && <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-md text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="type" className="block text-sm text-neutral6 mb-1">
            Deployment Type
          </label>
          <select
            id="type"
            value={type}
            onChange={e => setType(e.target.value as typeof type)}
            className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
          >
            <option value={DeploymentType.PRODUCTION}>Production</option>
            <option value={DeploymentType.STAGING}>Staging</option>
            <option value={DeploymentType.PREVIEW}>Preview</option>
          </select>
        </div>

        <div>
          <label htmlFor="branch" className="block text-sm text-neutral6 mb-1">
            Branch
          </label>
          <input
            id="branch"
            type="text"
            value={branch}
            onChange={e => setBranch(e.target.value)}
            required
            className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
          />
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
            disabled={createDeployment.isPending}
          >
            {createDeployment.isPending ? 'Creating...' : 'Create Deployment'}
          </button>
        </div>
      </form>
    </div>
  );
}
