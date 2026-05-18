import {
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  Skeleton,
  Avatar,
  Badge,
  Button,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Icon,
} from '@mastra/playground-ui';
import { ChevronRight, SettingsIcon, ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { isAuthenticated } from '@/domains/auth/types';
import { RoleManagementModal } from '@/domains/team/components';
import { useTeamMembers, useTeamMember, useRoles } from '@/domains/team/hooks';
import type { TeamMember } from '@/domains/team/hooks';
import { cn } from '@/lib/utils';

function formatLastActive(date?: string): string {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString();
}

function TeamMemberRow({ member, canManageRoles }: { member: TeamMember; canManageRoles: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Fetch full member details when expanded
  const { data: memberDetail, isLoading: detailLoading } = useTeamMember(member.id, { enabled: isOpen });
  const { data: allRoles = [] } = useRoles();

  // WorkOS: single role per org membership
  const currentRole = memberDetail?.role || member.role;
  const permissions = memberDetail?.permissions || [];
  const isLoadingDetails = isOpen && detailLoading;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="border-b border-border1">
          {/* Main row */}
          <CollapsibleTrigger asChild>
            <div className="flex items-center p-3 hover:bg-surface1 transition-colors cursor-pointer">
              {/* Chevron */}
              <div className="w-6 shrink-0">
                <Icon className={cn('transition-transform text-text2', isOpen && 'rotate-90')}>
                  <ChevronRight className="h-4 w-4" />
                </Icon>
              </div>

              {/* Member - flex-1 */}
              <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                <Avatar src={member.avatarUrl} name={member.name || member.email || member.id} size="sm" />
                <span className="font-medium text-text1 truncate">{member.name || member.id}</span>
              </div>

              {/* Email - fixed width */}
              <div className="w-52 shrink-0 text-text2 text-sm truncate pr-4">{member.email || '—'}</div>

              {/* Role(s) - fixed width */}
              <div className="w-32 shrink-0 pr-4 flex flex-wrap gap-1">
                {member.roles && member.roles.length > 0 ? (
                  member.roles.map(role => (
                    <Badge key={role} variant="default">
                      {role}
                    </Badge>
                  ))
                ) : member.role ? (
                  <Badge variant="default">{member.role}</Badge>
                ) : (
                  <span className="text-text2">—</span>
                )}
              </div>

              {/* Last Active - fixed width */}
              <div className="w-28 shrink-0 text-text2 text-sm pr-4">{formatLastActive(member.lastActiveAt)}</div>

              {/* Actions - fixed width */}
              <div className="w-36 shrink-0 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                {canManageRoles && (
                  <Button variant="outline" size="sm" onClick={() => setShowRoleModal(true)}>
                    <SettingsIcon className="h-3 w-3 mr-1" />
                    Manage
                  </Button>
                )}
                <Link to={`/team/${member.id}`}>
                  <Button variant="outline" size="sm">
                    <ExternalLinkIcon className="h-3 w-3 mr-1" />
                    Details
                  </Button>
                </Link>
              </div>
            </div>
          </CollapsibleTrigger>

          {/* Expanded content */}
          <CollapsibleContent>
            <div className="px-3 pb-4 pt-2 ml-6 bg-surface1/50">
              <div className="flex gap-8">
                {/* Role (WorkOS: single role per membership) */}
                <div className="min-w-0">
                  <h4 className="text-xs font-medium text-text2 uppercase tracking-wide mb-2">Role</h4>
                  {currentRole ? (
                    <Badge variant="default">{currentRole}</Badge>
                  ) : (
                    <p className="text-text2 text-sm">No role assigned</p>
                  )}
                </div>

                {/* Permissions */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-text2 uppercase tracking-wide mb-2">Permissions</h4>
                  {isLoadingDetails ? (
                    <Skeleton className="h-5 w-32" />
                  ) : permissions.length === 0 ? (
                    <p className="text-text2 text-sm">No permissions</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {permissions.map(perm => (
                        <code key={perm} className="px-1.5 py-0.5 bg-surface2 rounded text-xs text-text2">
                          {perm}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {showRoleModal && (
        <RoleManagementModal
          userId={member.id}
          userName={member.name || member.email || member.id}
          currentRole={currentRole}
          availableRoles={allRoles}
          onClose={() => setShowRoleModal(false)}
        />
      )}
    </>
  );
}

function TeamList({ members, isLoading }: { members: TeamMember[]; isLoading: boolean }) {
  const { hasPermission } = usePermissions();
  const { data: capabilities } = useAuthCapabilities();

  // Get RBAC capabilities to check if role assignment is supported
  const rbacCapabilities =
    capabilities && isAuthenticated(capabilities) ? capabilities.capabilities.rbacCapabilities : null;
  const supportsRoleAssignment = rbacCapabilities?.roleAssignment ?? false;

  // Can manage roles only if user has permission AND provider supports role assignment
  const canManageRoles = hasPermission('team:write') && supportsRoleAssignment;

  if (isLoading) {
    return (
      <div className="border border-border1 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center p-3 bg-surface2/80 border-b border-border1">
          <div className="w-6 shrink-0" />
          <div className="flex-1 text-xs font-medium text-text2 uppercase tracking-wide pr-4">Member</div>
          <div className="w-52 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide pr-4">Email</div>
          <div className="w-24 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide pr-4">Role</div>
          <div className="w-28 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide pr-4">Last Active</div>
          <div className="w-36 shrink-0" />
        </div>
        {/* Loading skeletons */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center p-3 border-b border-border1">
            <div className="w-6 shrink-0">
              <Skeleton className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-3 flex-1 pr-4">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="w-52 shrink-0 pr-4">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="w-24 shrink-0 pr-4">
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="w-28 shrink-0 pr-4">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="w-36 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return <div className="text-center py-12 text-text2 border border-border1 rounded-lg">No team members found</div>;
  }

  return (
    <div className="border border-border1 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-3 bg-surface2/80 border-b border-border1">
        <div className="w-6 shrink-0" />
        <div className="flex-1 text-xs font-medium text-text2 uppercase tracking-wide pr-4">Member</div>
        <div className="w-52 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide pr-4">Email</div>
        <div className="w-24 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide pr-4">Role</div>
        <div className="w-28 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide pr-4">Last Active</div>
        <div className="w-36 shrink-0" />
      </div>
      {/* Rows */}
      {members.map(member => (
        <TeamMemberRow key={member.id} member={member} canManageRoles={canManageRoles} />
      ))}
    </div>
  );
}

function Team() {
  const { data, isLoading, error } = useTeamMembers();
  const [search, setSearch] = useState('');
  const { hasPermission } = usePermissions();
  const canInvite = hasPermission('team:write');

  const members = data?.users ?? [];
  const filteredMembers = search
    ? members.filter(
        m =>
          m.name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase()),
      )
    : members;

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
        <div className="flex items-center justify-between gap-4">
          <div className="max-w-80">
            <ListSearch onSearch={setSearch} label="Search team" placeholder="Search by name or email" />
          </div>
          {canInvite && <Button variant="default">+ Invite</Button>}
        </div>
      </PageLayout.TopArea>

      <TeamList members={filteredMembers} isLoading={isLoading} />
    </PageLayout>
  );
}

export { Team };

export default Team;
