import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateTeam } from '@/hooks/teams/use-create-team';

export function NewTeamPage() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const createTeam = useCreateTeam();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const team = await createTeam.mutateAsync({ name });
      navigate(`/teams/${team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-neutral9 mb-6">Create Team</h1>

      {error && <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-md text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm text-neutral6 mb-1">
            Team Name
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
            disabled={createTeam.isPending}
          >
            {createTeam.isPending ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </form>
    </div>
  );
}
