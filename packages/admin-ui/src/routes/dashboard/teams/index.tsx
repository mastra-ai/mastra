import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { useTeams } from '@/hooks/teams/use-teams';

export function TeamsPage() {
  const { data: teams, isLoading } = useTeams();

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
        <h1 className="text-2xl font-semibold text-neutral9">Teams</h1>
        <Link
          to="/teams/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent1 text-white rounded-md hover:bg-accent2"
        >
          <Plus className="h-4 w-4" />
          New Team
        </Link>
      </div>

      {teams?.data && teams.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.data.map(team => (
            <Link
              key={team.id}
              to={`/teams/${team.id}`}
              className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
            >
              <h3 className="text-lg font-medium text-neutral9">{team.name}</h3>
              <p className="text-sm text-neutral6 mt-1">{team.slug}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-6 bg-surface2 rounded-lg border border-border text-center">
          <p className="text-neutral6">No teams yet. Create your first team to get started.</p>
        </div>
      )}
    </div>
  );
}
