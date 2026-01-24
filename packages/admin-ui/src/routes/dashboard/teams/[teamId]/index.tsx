import { useParams, Link } from 'react-router';
import { useTeam } from '@/hooks/teams/use-team';
import { Settings, Users, FolderGit2 } from 'lucide-react';

export function TeamOverview() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: team, isLoading } = useTeam(teamId!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-6 bg-surface2 rounded-lg border border-border text-center">
        <p className="text-neutral6">Team not found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral9">{team.name}</h1>
          <p className="text-sm text-neutral6">{team.slug}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          to={`/teams/${teamId}/projects`}
          className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
        >
          <FolderGit2 className="h-8 w-8 text-accent1 mb-3" />
          <h3 className="text-lg font-medium text-neutral9">Projects</h3>
          <p className="text-sm text-neutral6 mt-1">View and manage projects</p>
        </Link>

        <Link
          to={`/teams/${teamId}/members`}
          className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
        >
          <Users className="h-8 w-8 text-accent1 mb-3" />
          <h3 className="text-lg font-medium text-neutral9">Members</h3>
          <p className="text-sm text-neutral6 mt-1">Manage team members</p>
        </Link>

        <Link
          to={`/teams/${teamId}/settings`}
          className="p-6 bg-surface2 rounded-lg border border-border hover:border-accent1 transition-colors"
        >
          <Settings className="h-8 w-8 text-accent1 mb-3" />
          <h3 className="text-lg font-medium text-neutral9">Settings</h3>
          <p className="text-sm text-neutral6 mt-1">Team settings and configuration</p>
        </Link>
      </div>
    </div>
  );
}
