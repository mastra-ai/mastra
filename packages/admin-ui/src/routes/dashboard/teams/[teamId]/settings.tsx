import { useParams } from 'react-router';
import { useTeam } from '@/hooks/teams/use-team';

export function TeamSettings() {
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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-neutral9 mb-6">Team Settings</h1>

      <div className="space-y-6">
        <div className="p-6 bg-surface2 rounded-lg border border-border">
          <h2 className="text-lg font-medium text-neutral9 mb-4">General</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral6 mb-1">Team Name</label>
              <input
                type="text"
                defaultValue={team.name}
                className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral6 mb-1">Slug</label>
              <input
                type="text"
                defaultValue={team.slug}
                disabled
                className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral6"
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-surface2 rounded-lg border border-red-500/30">
          <h2 className="text-lg font-medium text-red-500 mb-4">Danger Zone</h2>
          <p className="text-sm text-neutral6 mb-4">
            Once you delete a team, there is no going back. Please be certain.
          </p>
          <button className="px-4 py-2 bg-red-500/10 text-red-500 rounded-md hover:bg-red-500/20">Delete Team</button>
        </div>
      </div>
    </div>
  );
}
