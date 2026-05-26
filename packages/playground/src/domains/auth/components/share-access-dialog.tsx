'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Combobox,
  toast,
  Spinner,
} from '@mastra/playground-ui';
import { X } from 'lucide-react';
import { useState, useMemo } from 'react';
import {
  useResourceAccess,
  useResourceTypeRoles,
  useAssignAccess,
  useRemoveAccess,
  useOrganizationMembers,
} from '../hooks/use-fga-share';
import type { FGAAccessEntry, OrgMember } from '../hooks/use-fga-share';

export interface ShareAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: string;
  resourceId: string;
  resourceName?: string;
}

export function ShareAccessDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName,
}: ShareAccessDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');

  // Fetch current access list
  const { data: accessData, isLoading: accessLoading } = useResourceAccess(resourceType, resourceId);

  // Fetch available roles for this resource type
  const { data: rolesData, isLoading: rolesLoading } = useResourceTypeRoles(resourceType);

  // Fetch organization members for search
  const { data: membersData } = useOrganizationMembers(searchTerm);

  // Mutations
  const { mutate: assignAccess, isPending: isAssigning } = useAssignAccess();
  const { mutate: removeAccess, isPending: isRemoving } = useRemoveAccess();

  // Filter out members who already have access
  const availableMembers = useMemo(() => {
    const existingMembershipIds = new Set(
      accessData?.assignments?.map((a: FGAAccessEntry) => a.organizationMembershipId) || [],
    );
    return (membersData?.members || []).filter(m => !existingMembershipIds.has(m.membershipId));
  }, [membersData?.members, accessData?.assignments]);

  // Convert members to Combobox options format
  const memberOptions = useMemo(() => {
    return availableMembers.map((member: OrgMember) => ({
      value: member.membershipId,
      label: member.name || member.email || member.membershipId,
      description: member.email && member.name ? member.email : undefined,
    }));
  }, [availableMembers]);

  const handleAssign = () => {
    if (!selectedMember || !selectedRole) {
      toast.error('Please select a user and role');
      return;
    }

    // accessData.resourceId is the WorkOS internal ID needed for assignRole API
    if (!accessData?.resourceId) {
      toast.error('Resource not found in FGA. Please register it first.');
      return;
    }

    assignAccess(
      {
        resourceType,
        externalResourceId: resourceId,
        resourceId: accessData.resourceId, // WorkOS internal ID
        membershipId: selectedMember,
        roleSlug: selectedRole,
      },
      {
        onSuccess: () => {
          toast.success('Access granted successfully');
          setSelectedMember('');
          setSelectedRole('');
          setSearchTerm('');
        },
        onError: (error: Error) => {
          toast.error(`Failed to grant access: ${error.message}`);
        },
      },
    );
  };

  const handleRemove = (entry: FGAAccessEntry) => {
    // accessData.resourceId is the WorkOS internal ID needed for removeRole API
    if (!accessData?.resourceId) {
      toast.error('Resource not found in FGA');
      return;
    }

    removeAccess(
      {
        resourceType,
        externalResourceId: resourceId,
        resourceId: accessData.resourceId, // WorkOS internal ID
        assignmentId: entry.id,
        roleSlug: entry.role,
      },
      {
        onSuccess: () => {
          toast.success('Access revoked successfully');
        },
        onError: (error: Error) => {
          toast.error(`Failed to revoke access: ${error.message}`);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {resourceName || resourceId}</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto space-y-6">
          {/* Add new access section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Add people</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Combobox
                  options={memberOptions}
                  value={selectedMember}
                  onValueChange={setSelectedMember}
                  placeholder="Search for a user..."
                  searchPlaceholder="Type to search..."
                  emptyText="No users found"
                />
              </div>
              <div className="w-40">
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesLoading ? (
                      <SelectItem value="_loading" disabled>
                        Loading...
                      </SelectItem>
                    ) : (
                      (rolesData?.roles || []).map(role => (
                        <SelectItem key={role.slug} value={role.slug}>
                          {role.name || role.slug}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="primary"
                onClick={handleAssign}
                disabled={!selectedMember || !selectedRole || isAssigning}
              >
                {isAssigning ? <Spinner className="w-4 h-4" /> : 'Add'}
              </Button>
            </div>
          </div>

          {/* Current access list */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">People with access</Label>
            {accessLoading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner className="w-5 h-5" />
              </div>
            ) : (accessData?.assignments || []).length === 0 ? (
              <p className="text-sm text-neutral3 py-2">No one else has access to this {resourceType}.</p>
            ) : (
              <div className="space-y-2">
                {(accessData?.assignments || []).map((entry: FGAAccessEntry) => {
                  // Display user name like auth-vnext does
                  const displayName =
                    entry.user?.firstName && entry.user?.lastName
                      ? `${entry.user.firstName} ${entry.user.lastName}`
                      : entry.user?.email || entry.organizationMembershipId;

                  return (
                    <div
                      key={`${entry.organizationMembershipId}-${entry.role}`}
                      className="flex items-center justify-between py-2 px-3 bg-surface2 rounded-md"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm">{displayName}</span>
                        {entry.user?.email && entry.user?.firstName && (
                          <span className="text-xs text-neutral3">{entry.user.email}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral3 bg-surface3 px-2 py-1 rounded">{entry.role}</span>
                        <button
                          onClick={() => handleRemove(entry)}
                          disabled={isRemoving}
                          className="text-neutral3 hover:text-red-500 transition-colors p-1"
                          title="Remove access"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
