import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SectionCard,
  SessionExpired,
  Skeleton,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { ArrowLeftIcon, SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { isAuthenticated } from '@/domains/auth/types';
import { RoleManagementModal } from '@/domains/team/components';
import { useRoles, useTeamMember } from '@/domains/team/hooks';

function formatDate(date?: string): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatLastActive(date?: string): string {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString();
}

function TeamMemberDetail() {
  const { id: userId } = useParams<{ id: string }>();
  const { data: member, isLoading: memberLoading, error: memberError } = useTeamMember(userId || '');
  const { data: allRoles = [] } = useRoles();
  const { data: capabilities } = useAuthCapabilities();
  const { hasPermission } = usePermissions();
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Get RBAC capabilities to determine single vs multi-role UI and if role assignment is supported
  const rbacCapabilities =
    capabilities && isAuthenticated(capabilities) ? capabilities.capabilities.rbacCapabilities : null;
  const isMultiRole = rbacCapabilities?.multiRole ?? false;
  const supportsRoleAssignment = rbacCapabilities?.roleAssignment ?? false;

  // Can manage roles only if user has permission AND provider supports role assignment
  const canManageRoles = hasPermission('team:write') && supportsRoleAssignment;

  const userRoles = member?.roles || [];
  const userPermissions = member?.permissions || [];
  const currentRole = userRoles[0] || null;

  if (memberError && is401UnauthorizedError(memberError)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (memberError && is403ForbiddenError(memberError)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="team member" />
      </NoDataPageLayout>
    );
  }

  if (memberError) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load team member" message={memberError.message} />
      </NoDataPageLayout>
    );
  }

  if (memberLoading || !member) {
    return (
      <PageLayout width="narrow">
        <PageLayout.MainArea className="flex flex-col gap-5 mt-6">
          <Link to="/team" className="inline-flex items-center gap-2 text-text2 hover:text-text1 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Team
          </Link>
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="narrow">
      <PageLayout.MainArea className="flex flex-col gap-5 mt-6">
        {/* Back link */}
        <Link to="/team" className="inline-flex items-center gap-2 text-text2 hover:text-text1 transition-colors">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Team
        </Link>

        {/* Profile header */}
        <div className="flex items-center gap-4">
          <Avatar src={member.avatarUrl} name={member.name || member.email || member.id} size="lg" />
          <div>
            <h1 className="text-xl font-semibold text-text1">{member.name || member.email || member.id}</h1>
            {member.email && member.name && <p className="text-sm text-text2">{member.email}</p>}
            <p className="text-xs text-text3 mt-1">
              Member since {formatDate(member.createdAt)} · Last active {formatLastActive(member.lastActiveAt)}
            </p>
          </div>
        </div>

        {/* Role section */}
        <SectionCard
          title={isMultiRole ? 'Roles' : 'Role'}
          description={
            isMultiRole ? 'The roles assigned to this team member.' : 'The role assigned to this team member.'
          }
          action={
            canManageRoles ? (
              <Button variant="outline" size="sm" onClick={() => setShowRoleModal(true)}>
                <SettingsIcon className="h-4 w-4 mr-2" />
                Manage
              </Button>
            ) : undefined
          }
        >
          <div className="py-2">
            {memberLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : isMultiRole ? (
              // Multi-role: show all roles
              userRoles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {userRoles.map(role => (
                    <Badge key={role} variant="default" className="capitalize">
                      {role}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-text2 text-sm">No roles assigned</span>
              )
            ) : currentRole ? (
              // Single-role: show current role
              <Badge variant="default" className="capitalize">
                {currentRole}
              </Badge>
            ) : (
              <span className="text-text2 text-sm">No role assigned</span>
            )}
          </div>
        </SectionCard>

        {/* Permissions section */}
        <SectionCard title="Effective Permissions" description="Permissions granted by this member's role.">
          <div className="py-2">
            {memberLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : userPermissions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userPermissions.map(permission => (
                  <Badge key={permission} variant="default" className="font-mono text-xs">
                    {permission}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-text2 text-sm">No permissions</span>
            )}
          </div>
        </SectionCard>
      </PageLayout.MainArea>

      {/* Role management modal */}
      {showRoleModal && (
        <RoleManagementModal
          userId={member.id}
          userName={member.name || member.email || member.id}
          currentRole={currentRole ?? undefined}
          currentRoles={userRoles}
          availableRoles={allRoles}
          rbacCapabilities={rbacCapabilities}
          onClose={() => setShowRoleModal(false)}
        />
      )}
    </PageLayout>
  );
}

export default TeamMemberDetail;
