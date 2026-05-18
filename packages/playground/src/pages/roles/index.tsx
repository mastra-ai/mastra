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
  Input,
  Textarea,
  Checkbox,
  AlertDialog,
  toast,
} from '@mastra/playground-ui';
import { PlusIcon, PencilIcon, TrashIcon, XIcon } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-context';
import { useRoles, useAvailablePermissions } from '@/domains/team/hooks';
import type { PermissionInfo } from '@/domains/team/hooks';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  providerPermissions?: string[];
  inherits?: string[];
  metadata?: {
    source?: 'provider' | 'roleMapping';
    resourceTypeSlug?: string;
    type?: string;
  };
}

// Fallback permissions when API is not available
const FALLBACK_PERMISSIONS: PermissionInfo[] = [
  {
    value: '*',
    label: 'All Permissions',
    description: 'Full access to everything',
    resource: null,
    action: null,
    isWildcard: true,
  },
  {
    value: '*:read',
    label: 'Read All',
    description: 'Read access to all resources',
    resource: null,
    action: 'read',
    isWildcard: true,
  },
  {
    value: '*:write',
    label: 'Write All',
    description: 'Write access to all resources',
    resource: null,
    action: 'write',
    isWildcard: true,
  },
  {
    value: '*:execute',
    label: 'Execute All',
    description: 'Execute access to all resources',
    resource: null,
    action: 'execute',
    isWildcard: true,
  },
];

function RoleFormModal({
  role,
  availablePermissions,
  permissionsLoading,
  onSave,
  onClose,
  isSaving,
}: {
  role: Role | null; // null = create new role
  availablePermissions: PermissionInfo[];
  permissionsLoading: boolean;
  onSave: (role: Omit<Role, 'id'> & { id?: string }) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const isEditing = role !== null;
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(role?.permissions ?? []);
  const [permissionFilter, setPermissionFilter] = useState('');

  // Filter and group permissions
  const groupedPermissions = useMemo(() => {
    const filterLower = permissionFilter.toLowerCase();

    // Filter permissions by search term
    const filtered = permissionFilter
      ? availablePermissions.filter(
          p =>
            p.value.toLowerCase().includes(filterLower) ||
            p.label.toLowerCase().includes(filterLower) ||
            p.description.toLowerCase().includes(filterLower) ||
            (p.resource?.toLowerCase().includes(filterLower) ?? false),
        )
      : availablePermissions;

    const wildcards = filtered.filter(p => p.isWildcard);
    const specific = filtered.filter(p => !p.isWildcard);

    // Group specific permissions by resource
    const byResource: Record<string, PermissionInfo[]> = {};
    for (const perm of specific) {
      const resource = perm.resource || 'other';
      if (!byResource[resource]) {
        byResource[resource] = [];
      }
      byResource[resource].push(perm);
    }

    return { wildcards, byResource };
  }, [availablePermissions, permissionFilter]);

  const handleTogglePermission = (permission: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permission) ? prev.filter(p => p !== permission) : [...prev, permission],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      ...(isEditing ? { id: role.id } : {}),
      name: name.trim(),
      description: description.trim() || undefined,
      permissions: selectedPermissions,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface1 border border-border1 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text1">{isEditing ? `Edit Role: ${role.name}` : 'Create Role'}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Icon>
              <XIcon className="h-4 w-4" />
            </Icon>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text1 mb-1">Role Name *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Developer, Support, Analyst"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text1 mb-1">Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this role is for..."
              rows={2}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-text1">Permissions</label>
              {selectedPermissions.length > 0 && (
                <span className="text-xs text-text2">{selectedPermissions.length} selected</span>
              )}
            </div>
            {permissionsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <Input
                  value={permissionFilter}
                  onChange={e => setPermissionFilter(e.target.value)}
                  placeholder="Filter permissions..."
                  className="mb-2"
                />
                <div className="border border-border1 rounded-lg p-3 space-y-4 max-h-64 overflow-y-auto">
                  {/* No results message */}
                  {groupedPermissions.wildcards.length === 0 &&
                    Object.keys(groupedPermissions.byResource).length === 0 && (
                      <div className="text-sm text-text2 text-center py-4">
                        No permissions match "{permissionFilter}"
                      </div>
                    )}
                  {/* Wildcard permissions at the top */}
                  {groupedPermissions.wildcards.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-text2 mb-2 uppercase">Global</div>
                      <div className="space-y-1">
                        {groupedPermissions.wildcards.map(perm => (
                          <label
                            key={perm.value}
                            className="flex items-start gap-3 cursor-pointer hover:bg-surface2 p-2 rounded"
                          >
                            <Checkbox
                              checked={selectedPermissions.includes(perm.value)}
                              onCheckedChange={() => handleTogglePermission(perm.value)}
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-text1">{perm.label}</div>
                              <div className="text-xs text-text2">{perm.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Specific permissions grouped by resource */}
                  {Object.entries(groupedPermissions.byResource)
                    .sort()
                    .map(([resource, perms]) => (
                      <div key={resource}>
                        <div className="text-xs font-medium text-text2 mb-2 uppercase">
                          {resource.replace(/-/g, ' ')}
                        </div>
                        <div className="space-y-1">
                          {perms.map(perm => (
                            <label
                              key={perm.value}
                              className="flex items-start gap-3 cursor-pointer hover:bg-surface2 p-2 rounded"
                            >
                              <Checkbox
                                checked={selectedPermissions.includes(perm.value)}
                                onCheckedChange={() => handleTogglePermission(perm.value)}
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-text1">{perm.label}</div>
                                <div className="text-xs text-text2">{perm.description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving}>
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleRow({
  role,
  onEdit,
  onDelete,
  canManage,
  expanded,
  onToggleExpand,
}: {
  role: Role;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  canManage: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div className="border-b border-border1 last:border-b-0">
      <div
        className="flex items-center p-4 hover:bg-surface2/50 transition-colors cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Role name and description */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-text1">{role.name}</div>
          {role.description && <div className="text-sm text-text2 mt-0.5">{role.description}</div>}
        </div>

        {/* Permissions count */}
        <div className="w-32 shrink-0 text-center">
          <Badge variant="default">
            {role.permissions.length} {role.permissions.length === 1 ? 'permission' : 'permissions'}
          </Badge>
        </div>

        {/* Inherits */}
        <div className="w-32 shrink-0 text-center text-text2 text-sm">
          {role.inherits && role.inherits.length > 0 ? `Inherits: ${role.inherits.join(', ')}` : '—'}
        </div>

        {/* Actions */}
        {canManage && (
          <div className="w-24 shrink-0 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
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

      {/* Expanded permissions detail */}
      {expanded && (
        <div className="px-4 pb-4 bg-surface2/30">
          <div className="flex flex-wrap gap-1">
            {role.permissions.length > 0 ? (
              role.permissions.map(perm => (
                <Badge key={perm} variant="default" className="text-xs">
                  {perm}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-text3">No permissions assigned</span>
            )}
          </div>
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
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);

  const toggleExpand = (roleId: string) => {
    setExpandedRoleId(prev => (prev === roleId ? null : roleId));
  };

  if (isLoading) {
    return (
      <div className="border border-border1 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center p-4 bg-surface2/80 border-b border-border1">
          <div className="flex-1 text-xs font-medium text-text2 uppercase tracking-wide">Role</div>
          <div className="w-40 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide text-center">
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
            <div className="w-40 shrink-0 flex justify-center gap-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20" />
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
    return (
      <div className="text-center py-12 border border-border1 rounded-lg">
        <div className="text-text2 mb-2">No roles defined</div>
        <div className="text-sm text-text3">Create a role to get started with access control.</div>
      </div>
    );
  }

  return (
    <div className="border border-border1 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-4 bg-surface2/80 border-b border-border1">
        <div className="flex-1 text-xs font-medium text-text2 uppercase tracking-wide">Role</div>
        <div className="w-40 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide text-center">
          Permissions
        </div>
        <div className="w-32 shrink-0 text-xs font-medium text-text2 uppercase tracking-wide text-center">Inherits</div>
        {canManage && <div className="w-24 shrink-0" />}
      </div>
      {roles.map(role => (
        <RoleRow
          key={role.id}
          role={role}
          onEdit={onEdit}
          onDelete={onDelete}
          canManage={canManage}
          expanded={expandedRoleId === role.id}
          onToggleExpand={() => toggleExpand(role.id)}
        />
      ))}
    </div>
  );
}

function Roles() {
  const { data: roles = [], isLoading, error, refetch } = useRoles();
  const { hasPermission } = usePermissions();
  const { data: authCapabilities } = useAuthCapabilities();
  const { baseUrl, apiPrefix } = useStudioConfig();
  // Can only manage roles if user has permission AND provider supports dynamic roles
  const rbacCapabilities =
    authCapabilities && 'capabilities' in authCapabilities ? authCapabilities.capabilities.rbacCapabilities : null;
  const canManage = hasPermission('team:write') && rbacCapabilities?.dynamicRoles;

  // Fetch available permissions from API (generated from SERVER_ROUTES)
  const { permissions: availablePermissions, isLoading: permissionsLoading } = useAvailablePermissions();
  // Use fallback if API fails
  const permissionsToUse = availablePermissions.length > 0 ? availablePermissions : FALLBACK_PERMISSIONS;

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<Role | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (role: Role) => {
    setEditingRole(role);
  };

  const handleDeleteClick = (role: Role) => {
    setDeleteConfirmRole(role);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmRole) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${baseUrl}${apiPrefix}/auth/roles/${deleteConfirmRole.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || data.message || 'Failed to delete role');
        return;
      }

      toast.success(`Role "${deleteConfirmRole.name}" deleted`);
      void refetch();
    } catch {
      toast.error('Failed to delete role');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmRole(null);
    }
  };

  const handleSaveRole = useCallback(
    async (roleData: Omit<Role, 'id'> & { id?: string }) => {
      setIsSaving(true);
      try {
        const isEditing = !!roleData.id;
        const url = isEditing
          ? `${baseUrl}${apiPrefix}/auth/roles/${roleData.id}`
          : `${baseUrl}${apiPrefix}/auth/roles`;

        const response = await fetch(url, {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mastra-client-type': 'studio',
          },
          credentials: 'include',
          body: JSON.stringify({
            name: roleData.name,
            description: roleData.description,
            permissions: roleData.permissions,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          toast.error(data.error || data.message || `Failed to ${isEditing ? 'update' : 'create'} role`);
          return;
        }

        toast.success(`Role ${isEditing ? 'updated' : 'created'} successfully`);
        void refetch();
        setShowCreateModal(false);
        setEditingRole(null);
      } catch {
        toast.error('Failed to save role');
      } finally {
        setIsSaving(false);
      }
    },
    [baseUrl, apiPrefix, refetch],
  );

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
        onDelete={handleDeleteClick}
        canManage={canManage ?? false}
      />

      {/* Create Role Modal */}
      {showCreateModal && (
        <RoleFormModal
          role={null}
          availablePermissions={permissionsToUse}
          permissionsLoading={permissionsLoading}
          onSave={handleSaveRole}
          onClose={() => setShowCreateModal(false)}
          isSaving={isSaving}
        />
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <RoleFormModal
          role={editingRole}
          availablePermissions={permissionsToUse}
          permissionsLoading={permissionsLoading}
          onSave={handleSaveRole}
          onClose={() => setEditingRole(null)}
          isSaving={isSaving}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmRole} onOpenChange={open => !open && setDeleteConfirmRole(null)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Role</AlertDialog.Title>
            <AlertDialog.Description>
              Are you sure you want to delete the "{deleteConfirmRole?.name}" role? This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </PageLayout>
  );
}

export { Roles };

export default Roles;
