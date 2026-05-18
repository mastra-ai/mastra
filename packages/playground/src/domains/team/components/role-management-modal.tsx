import { Button, Badge } from '@mastra/playground-ui';
import { XIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';
import type { RBACCapabilities } from '@/domains/auth/types';
import { useAssignRole, useRemoveRole } from '@/domains/team/hooks';

interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
}

interface RoleManagementModalProps {
  userId: string;
  userName: string;
  /** For single-role providers: the current role ID */
  currentRole?: string;
  /** For multi-role providers: array of current role IDs */
  currentRoles?: string[];
  availableRoles: RoleDefinition[];
  /** RBAC provider capabilities - determines UI behavior */
  rbacCapabilities?: RBACCapabilities | null;
  onClose: () => void;
}

/**
 * Role management modal that adapts to provider capabilities.
 *
 * Single-role providers (WorkOS): radio button UI, changing roles replaces current one
 * Multi-role providers: checkbox UI, can add/remove multiple roles
 */
export function RoleManagementModal({
  userId,
  userName,
  currentRole,
  currentRoles = [],
  availableRoles,
  rbacCapabilities,
  onClose,
}: RoleManagementModalProps) {
  const { mutate: assignRole, isPending: isAssigning } = useAssignRole();
  const { mutate: removeRole, isPending: isRemoving } = useRemoveRole();
  const isPending = isAssigning || isRemoving;

  // Determine if this is a multi-role provider
  const isMultiRole = rbacCapabilities?.multiRole ?? false;

  // For single-role mode, track the selected role
  const [selectedRole, setSelectedRole] = useState<string | null>(currentRole ?? null);

  // For multi-role mode, track selected roles
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set(currentRoles));

  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const handleSingleRoleChange = (roleId: string) => {
    setSelectedRole(roleId);
    assignRole(
      { userId, roleId },
      {
        onSuccess: () => {
          // Role changed successfully
        },
      },
    );
  };

  const handleMultiRoleToggle = (roleId: string) => {
    const isCurrentlySelected = selectedRoles.has(roleId);
    const newSelectedRoles = new Set(selectedRoles);

    if (isCurrentlySelected) {
      // Remove role
      newSelectedRoles.delete(roleId);
      setSelectedRoles(newSelectedRoles);
      removeRole(
        { userId, roleId },
        {
          onSuccess: () => {
            // Role removed successfully
          },
        },
      );
    } else {
      // Add role
      newSelectedRoles.add(roleId);
      setSelectedRoles(newSelectedRoles);
      assignRole(
        { userId, roleId },
        {
          onSuccess: () => {
            // Role added successfully
          },
        },
      );
    }
  };

  const currentRoleObj = availableRoles.find(r => r.id === currentRole);
  const currentRoleObjs = availableRoles.filter(r => currentRoles.includes(r.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative rounded-xl border border-border1/40 bg-surface2/96 backdrop-blur-md shadow-dialog w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border1">
          <div>
            <h2 className="text-lg font-semibold text-neutral6">{isMultiRole ? 'Manage Roles' : 'Change Role'}</h2>
            <p className="text-sm text-neutral4 mt-0.5">{userName}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface3 rounded transition-colors" aria-label="Close">
            <XIcon className="h-5 w-5 text-neutral4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Current Role(s) */}
          {isMultiRole
            ? // Multi-role: show all current roles
              currentRoleObjs.length > 0 && (
                <div className="mb-4 p-3 bg-surface3 rounded-lg border border-border1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-neutral4 uppercase tracking-wide">Current Roles</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {currentRoleObjs.map(role => (
                      <Badge key={role.id} variant="default">
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )
            : // Single-role: show current role
              currentRoleObj && (
                <div className="mb-4 p-3 bg-surface3 rounded-lg border border-border1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-neutral4 uppercase tracking-wide">Current Role</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{currentRoleObj.name}</Badge>
                    {currentRoleObj.description && (
                      <span className="text-sm text-neutral4">— {currentRoleObj.description}</span>
                    )}
                  </div>
                </div>
              )}

          {/* Role Options */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-neutral4 uppercase tracking-wide">
              {isMultiRole ? 'Toggle Roles' : 'Select Role'}
            </span>
            {availableRoles.map(role => {
              const isSelected = isMultiRole ? selectedRoles.has(role.id) : selectedRole === role.id;
              const isCurrent = isMultiRole ? currentRoles.includes(role.id) : currentRole === role.id;

              return (
                <div
                  key={role.id}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    isSelected ? 'border-accent1 bg-accent1/5' : 'border-border1'
                  }`}
                >
                  <button
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-surface3 transition-colors disabled:opacity-50"
                    onClick={() => {
                      if (isMultiRole) {
                        handleMultiRoleToggle(role.id);
                      } else if (!isCurrent) {
                        handleSingleRoleChange(role.id);
                      }
                    }}
                    disabled={isPending || (!isMultiRole && isCurrent)}
                  >
                    <div className="flex items-center gap-3">
                      {isMultiRole ? (
                        // Checkbox for multi-role
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'border-accent1 bg-accent1' : 'border-border2'
                          }`}
                        >
                          {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
                        </div>
                      ) : (
                        // Radio for single-role
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-accent1 bg-accent1' : 'border-border2'
                          }`}
                        >
                          {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-neutral6">{role.name}</span>
                        {role.description && <p className="text-sm text-neutral4 mt-0.5">{role.description}</p>}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="text-xs text-neutral4 bg-surface4 px-2 py-1 rounded">
                        {isMultiRole ? 'Assigned' : 'Current'}
                      </span>
                    )}
                  </button>

                  {/* Permissions preview */}
                  {role.permissions && role.permissions.length > 0 && (
                    <>
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-neutral4 hover:bg-surface3 transition-colors border-t border-border1"
                        onClick={e => {
                          e.stopPropagation();
                          setExpandedRole(expandedRole === role.id ? null : role.id);
                        }}
                      >
                        {expandedRole === role.id ? '▼' : '▶'} Permissions ({role.permissions.length})
                      </button>
                      {expandedRole === role.id && (
                        <div className="px-3 pb-3">
                          <div className="flex flex-wrap gap-1">
                            {role.permissions.map(perm => (
                              <code key={perm} className="px-1.5 py-0.5 bg-surface4 rounded text-xs text-neutral4">
                                {perm}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border1 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
