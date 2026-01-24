import { useParams } from 'react-router';
import { useTeamMembers } from '@/hooks/teams/use-team-members';
import { UserPlus } from 'lucide-react';

export function TeamMembers() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: members, isLoading } = useTeamMembers(teamId!);

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
        <h1 className="text-2xl font-semibold text-neutral9">Team Members</h1>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-accent1 text-white rounded-md hover:bg-accent2">
          <UserPlus className="h-4 w-4" />
          Invite Member
        </button>
      </div>

      <div className="bg-surface2 rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Role</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-neutral6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members?.data && members.data.length > 0 ? (
              members.data.map(member => (
                <tr key={member.userId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-sm text-neutral9">{member.user?.name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-sm text-neutral6">{member.user?.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs font-medium bg-accent1/10 text-accent1 rounded">{member.role}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-sm text-neutral6 hover:text-red-500">Remove</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral6">
                  No members yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
