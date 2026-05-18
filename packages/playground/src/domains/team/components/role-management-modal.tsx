import { Button, Badge } from '@mastra/playground-ui';
import { XIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useAssignRole } from '@/domains/team/hooks';

interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
}

interface RoleManagementModalProps {
  userId: string;
  userName: string;
  currentRole?: string; // WorkOS: single role per org membership
  availableRoles: RoleDefinition[];
  onClose: () => void;
}

/**
 * Role management modal for WorkOS.
 *
 * WorkOS uses a single role per organization membership model.
 * Users can have one role at a time - changing roles replaces the current one.
 */
export function RoleManagementModal({
  userId,
  userName,
  currentRole,
  availableRoles,
  onClose,
}: RoleManagementModalProps) {
  const { mutate: assignRole, isPending } = useAssignRole();
  const [selectedRole, setSelectedRole] = useState<string | null>(currentRole ?? null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const handleChangeRole = (roleId: string) => {
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

  const currentRoleObj = availableRoles.find(r => r.id === currentRole);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface0 border border-border1 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border1">
          <div>
            <h2 className="text-lg font-semibold text-text1">Change Role</h2>
            <p className="text-sm text-text2 mt-0.5">{userName}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface1 rounded transition-colors" aria-label="Close">
            <XIcon className="h-5 w-5 text-text2" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Current Role */}
          {currentRoleObj && (
            <div className="mb-4 p-3 bg-surface1 rounded-lg border border-border1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-text2 uppercase tracking-wide">Current Role</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">{currentRoleObj.name}</Badge>
                {currentRoleObj.description && (
                  <span className="text-sm text-text2">— {currentRoleObj.description}</span>
                )}
              </div>
            </div>
          )}

          {/* Role Options */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-text2 uppercase tracking-wide">Select Role</span>
            {availableRoles.map(role => {
              const isSelected = selectedRole === role.id;
              const isCurrent = currentRole === role.id;

              return (
                <div
                  key={role.id}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    isSelected ? 'border-accent1 bg-accent1/5' : 'border-border1'
                  }`}
                >
                  <button
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-surface1 transition-colors disabled:opacity-50"
                    onClick={() => !isCurrent && handleChangeRole(role.id)}
                    disabled={isPending || isCurrent}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-accent1 bg-accent1' : 'border-border2'
                        }`}
                      >
                        {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
                      </div>
                      <div>
                        <span className="font-medium text-text1">{role.name}</span>
                        {role.description && <p className="text-sm text-text2 mt-0.5">{role.description}</p>}
                      </div>
                    </div>
                    {isCurrent && <span className="text-xs text-text2 bg-surface2 px-2 py-1 rounded">Current</span>}
                  </button>

                  {/* Permissions preview */}
                  {role.permissions && role.permissions.length > 0 && (
                    <>
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-text2 hover:bg-surface1 transition-colors border-t border-border1"
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
                              <code key={perm} className="px-1.5 py-0.5 bg-surface2 rounded text-xs text-text2">
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
