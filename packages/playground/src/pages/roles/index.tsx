import {
  Button,
  ErrorState,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  Skeleton,
  Badge,
  Icon,
} from '@mastra/playground-ui';
import { PlusIcon, PencilIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useRoles } from '@/domains/team/hooks';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  inherits?: string[];
}

function RoleRow({
  role,
  onEdit,
  onDelete,
  canManage,
}: {
  role: Role;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  canManage: boolean;
}) {
  return (
    <div className="flex items-center p-4 border-b border-border1 last:border-b-0 hover:bg-surface1 transition-colors">
      {/* Role name and description */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text1">{role.name}</div>
        {role.description && <div className="text-sm text-text2 mt-0.5">{role.description}</div>}
      </div>

      {/* Permissions count */}
      <div className="w-32 shrink-0 text-center">
        <Badge variant="default">{role.permissions.length} permissions</Badge>
      </div>

      {/* Inherits */}
      <div className="w-32 shrink-0 text-center text-text2 text-sm">
        {role.inherits && role.inherits.length > 0 ? `Inherits: ${role.inherits.join(', ')}` : '—'}
      </div>

      {/* Actions */}
      {canManage && (
        <div className="w-24 shrink-0 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(role)} aria-label={`Edit ${role.name}`}>
            <Icon>
              <PencilIcon className="h-4 w-4" />
            </Icon>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(role)} aria-label={`Delete ${role.name}`}>
            <Icon>
              <TrashIcon className="h-4 w-4" />
            </Icon>
          </Button>
        </div>
      )}
    </div>
  );
}

function RolesTable({
  roles,
  isLoading,
  onEdit,
  onDelete,
  canManage,
}: {
  roles: Role[];
  isLoading: boolean;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  canManage: boolean;
}) {
  if (isLoading) {
    return (
      <div className="border border-border1 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center p-4 bg-surface2/80 border-b border-border1">
          <div className="flex-1 text-xs font-medium text-text2 uppercase tracking-wide">Role</div>
          <div className="w-32 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide text-center">
            Permissions
          </div>
          <div className="w-32 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide text-center">
            Inherits
          </div>
          {canManage && <div className="w-24 shrink-0" />}
        </div>
        {/* Loading skeletons */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center p-4 border-b border-border1">
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="w-32 shrink-0 flex justify-center">
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="w-32 shrink-0 flex justify-center">
              <Skeleton className="h-4 w-16" />
            </div>
            {canManage && (
              <div className="w-24 shrink-0 flex justify-end gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (roles.length === 0) {
    return <div className="text-center py-8 text-text2">No roles defined</div>;
  }

  return (
    <div className="border border-border1 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-4 bg-surface2/80 border-b border-border1">
        <div className="flex-1 text-xs font-medium text-text2 uppercase tracking-wide">Role</div>
        <div className="w-32 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide text-center">
          Permissions
        </div>
        <div className="w-32 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide text-center">Inherits</div>
        {canManage && <div className="w-24 shrink-0" />}
      </div>
      {roles.map(role => (
        <RoleRow key={role.id} role={role} onEdit={onEdit} onDelete={onDelete} canManage={canManage} />
      ))}
    </div>
  );
}

function Roles() {
  const { data: roles = [], isLoading, error, refetch } = useRoles();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('team:write');

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleEdit = (role: Role) => {
    setEditingRole(role);
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Are you sure you want to delete the "${role.name}" role?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/roles/${role.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.message || 'Failed to delete role');
        return;
      }

      void refetch();
    } catch {
      alert('Failed to delete role');
    }
  };

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
        <PermissionDenied resource="roles" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load roles" message={error.message} />
      </NoDataPageLayout>
    );
  }

  // Transform roles to Role[] type (API returns { roles: Role[] })
  const rolesList: Role[] = Array.isArray(roles) ? roles : [];

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text1">Role Definitions</h2>
          {canManage && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Icon className="mr-2">
                <PlusIcon className="h-4 w-4" />
              </Icon>
              Create Role
            </Button>
          )}
        </div>
      </PageLayout.TopArea>

      <RolesTable
        roles={rolesList}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canManage={canManage}
      />

      {/* TODO: Add CreateRoleModal and EditRoleModal components */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface1 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-text1 mb-4">Create Role</h3>
            <p className="text-text2 mb-4">Role creation UI coming soon.</p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {editingRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface1 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-text1 mb-4">Edit Role: {editingRole.name}</h3>
            <p className="text-text2 mb-4">Role editing UI coming soon.</p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setEditingRole(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export { Roles };

export default Roles;
