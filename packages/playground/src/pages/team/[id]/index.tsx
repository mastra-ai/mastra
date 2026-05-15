import {
  Avatar,
  ErrorState,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  Skeleton,
  Badge,
  Button,
} from '@mastra/playground-ui';
import { PlusIcon, XIcon } from 'lucide-react';
import { useParams } from 'react-router';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useTeamMember, useUserRoles, useRoles, useAssignRole, useRemoveRole } from '@/domains/team/hooks';

function RoleBadge({ role, onRemove, canRemove }: { role: string; onRemove?: () => void; canRemove: boolean }) {
  return (
    <Badge variant="default" className="flex items-center gap-1">
      {role}
      {canRemove && onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:bg-surface2 rounded p-0.5 transition-colors"
          aria-label={`Remove ${role} role`}
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

function RoleSelector({
  userId,
  currentRoles,
  availableRoles,
}: {
  userId: string;
  currentRoles: string[];
  availableRoles: { id: string; name: string }[];
}) {
  const { mutate: assignRole, isPending } = useAssignRole();
  const unassignedRoles = availableRoles.filter(r => !currentRoles.includes(r.id));

  if (unassignedRoles.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {unassignedRoles.map(role => (
        <Button
          key={role.id}
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => assignRole({ userId, roleId: role.id })}
        >
          <PlusIcon className="h-3 w-3 mr-1" />
          {role.name}
        </Button>
      ))}
    </div>
  );
}

function TeamMemberDetail() {
  const { id: userId } = useParams<{ id: string }>();
  const { data: member, isLoading: memberLoading, error: memberError } = useTeamMember(userId || '');
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(userId || '');
  const { data: allRoles = [] } = useRoles();
  const { mutate: removeRole } = useRemoveRole();
  const { hasPermission } = usePermissions();

  const canManageRoles = hasPermission('team:write');
  const isLoading = memberLoading || rolesLoading;

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

  if (isLoading || !member) {
    return (
      <PageLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-8">
        {/* User info */}
        <div className="flex items-center gap-4">
          <Avatar src={member.avatarUrl} name={member.name || member.email || member.id} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold text-text1">{member.name || member.email || member.id}</h1>
            {member.email && member.name && <p className="text-text2">{member.email}</p>}
          </div>
        </div>

        {/* Roles section */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-text1">Roles</h2>

          {/* Current roles */}
          <div className="flex flex-wrap gap-2">
            {userRoles.length === 0 ? (
              <p className="text-text2">No roles assigned</p>
            ) : (
              userRoles.map(role => (
                <RoleBadge
                  key={role}
                  role={role}
                  canRemove={canManageRoles}
                  onRemove={canManageRoles && userId ? () => removeRole({ userId, roleId: role }) : undefined}
                />
              ))
            )}
          </div>

          {/* Add role buttons */}
          {canManageRoles && userId && (
            <div className="pt-2">
              <h3 className="text-sm font-medium text-text2 mb-2">Assign role</h3>
              <RoleSelector userId={userId} currentRoles={userRoles} availableRoles={allRoles} />
            </div>
          )}
        </div>

        {/* Activity section - placeholder for future */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-text1">Recent Activity</h2>
          <p className="text-text2">
            Activity tracking coming soon. You can view this user's activity in{' '}
            <a href={`/traces?filterUserId=${userId}`} className="text-brand1 hover:underline">
              Traces
            </a>
            .
          </p>
        </div>
      </div>
    </PageLayout>
  );
}

export { TeamMemberDetail };

export default TeamMemberDetail;
