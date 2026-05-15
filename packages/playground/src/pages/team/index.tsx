import {
  Avatar,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  Skeleton,
} from '@mastra/playground-ui';
import { useState } from 'react';
import { useTeamMembers } from '@/domains/team/hooks';
import type { TeamMember } from '@/domains/team/hooks';

function TeamMemberRow({ member }: { member: TeamMember }) {
  return (
    <a
      href={`/team/${member.id}`}
      className="flex items-center gap-3 p-4 hover:bg-surface1 rounded-lg border border-border1 transition-colors"
    >
      <Avatar src={member.avatarUrl} name={member.name || member.email || member.id} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text1 truncate">{member.name || member.email || member.id}</div>
        {member.email && member.name && <div className="text-sm text-text2 truncate">{member.email}</div>}
      </div>
    </a>
  );
}

function TeamMembersList({
  members,
  isLoading,
  search,
}: {
  members: TeamMember[];
  isLoading: boolean;
  search: string;
}) {
  const filteredMembers = search
    ? members.filter(
        m =>
          m.name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase()),
      )
    : members;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (filteredMembers.length === 0) {
    return (
      <div className="text-center py-8 text-text2">
        {search ? `No team members match "${search}"` : 'No team members found'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredMembers.map(member => (
        <TeamMemberRow key={member.id} member={member} />
      ))}
    </div>
  );
}

function Team() {
  const { data, isLoading, error } = useTeamMembers();
  const [search, setSearch] = useState('');
  const members = data?.users ?? [];

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="team" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load team" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (members.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-text1">No Team Members</h2>
          <p className="text-text2">Team members will appear here when users authenticate with Studio.</p>
        </div>
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter team members" placeholder="Search by name or email" />
        </div>
      </PageLayout.TopArea>

      <TeamMembersList members={members} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}

export { Team };

export default Team;
