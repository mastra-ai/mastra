import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateTeam } from '@/hooks/teams/use-create-team';
import { TeamForm } from '@/components/teams/team-form';

export function NewTeamPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const createTeam = useCreateTeam();

  const handleSubmit = async (values: { name: string; slug?: string }) => {
    setError(null);

    try {
      const slug =
        values.slug ||
        values.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
      const team = await createTeam.mutateAsync({ name: values.name, slug });
      navigate(`/teams/${team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-neutral9 mb-6">Create Team</h1>

      {error && <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-md text-sm">{error}</div>}

      <TeamForm onSubmit={handleSubmit} loading={createTeam.isPending} />

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mt-4 px-4 py-2 bg-surface3 text-neutral9 rounded-md hover:bg-surface4"
      >
        Cancel
      </button>
    </div>
  );
}
