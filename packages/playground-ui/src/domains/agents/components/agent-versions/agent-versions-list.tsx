'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Skeleton } from '@/ds/components/Skeleton';
import { Check, GitCompare, RotateCcw, Trash2 } from 'lucide-react';
import type { AgentVersionResponse } from '@mastra/client-js';
import { useAgentVersions, useActivateAgentVersion, useDeleteAgentVersion } from '../../hooks/use-agent-versions';
import { SaveVersionDialog } from './save-version-dialog';
import { VersionCompareDialog } from './version-compare-dialog';
import { toast } from '@/lib/toast';

interface AgentVersionsListProps {
  agentId: string;
  activeVersionId?: string;
}

interface VersionListItemProps {
  version: AgentVersionResponse;
  isActive: boolean;
  onActivate: () => void;
  onDelete: () => void;
}

function VersionListItem({ version, isActive, onActivate, onDelete }: VersionListItemProps) {
  return (
    <div className="p-4 hover:bg-surface2 border-b border-border1 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">v{version.versionNumber}</span>
            {isActive && (
              <Badge variant="success" className="text-xs">
                <Check className="w-3 h-3 mr-1" />
                Active
              </Badge>
            )}
          </div>

          {version.name && <p className="text-sm text-icon3 mt-0.5 truncate">{version.name}</p>}

          {version.changedFields && version.changedFields.length > 0 && (
            <p className="text-xs text-icon3 mt-1">Changed: {version.changedFields.join(', ')}</p>
          )}

          <p className="text-xs text-icon3 mt-1">{format(new Date(version.createdAt), 'MMM d, yyyy h:mm a')}</p>
        </div>

        <div className="flex gap-1">
          {!isActive && (
            <>
              <Button variant="ghost" size="md" onClick={onActivate} title="Activate">
                <Check className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="md" onClick={onDelete} title="Delete">
                <Trash2 className="w-4 h-4 text-accent2" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentVersionsList({ agentId, activeVersionId }: AgentVersionsListProps) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isCompareDialogOpen, setIsCompareDialogOpen] = useState(false);
  const [page, setPage] = useState(0);

  const { data, isLoading } = useAgentVersions({ agentId, params: { page, perPage: 10 } });
  const { mutate: activateVersion, isPending: isActivating } = useActivateAgentVersion({ agentId });
  const { mutate: deleteVersion, isPending: isDeleting } = useDeleteAgentVersion({ agentId });

  const versions = data?.versions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 10);

  const handleActivate = (versionId: string) => {
    activateVersion(versionId, {
      onSuccess: () => {
        toast.success('Version activated successfully');
      },
      onError: error => {
        toast.error(`Failed to activate version: ${error.message}`);
      },
    });
  };

  const handleDelete = (versionId: string) => {
    if (confirm('Are you sure you want to delete this version?')) {
      deleteVersion(versionId, {
        onSuccess: () => {
          toast.success('Version deleted successfully');
        },
        onError: error => {
          toast.error(`Failed to delete version: ${error.message}`);
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border1 flex items-center justify-between">
        <h3 className="text-sm font-medium text-icon6">Versions ({total})</h3>
        <div className="flex items-center gap-2">
          {versions.length >= 2 && (
            <Button variant="ghost" size="md" onClick={() => setIsCompareDialogOpen(true)} title="Compare Versions">
              <GitCompare className="w-4 h-4" />
            </Button>
          )}
          <Button size="md" onClick={() => setIsSaveDialogOpen(true)}>
            Save Version
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="p-8 text-center text-icon3">
            <p className="text-sm">No versions saved yet.</p>
            <p className="text-xs mt-1">Save a version to track changes over time.</p>
          </div>
        ) : (
          <div>
            {versions.map(version => (
              <VersionListItem
                key={version.id}
                version={version}
                isActive={version.id === activeVersionId}
                onActivate={() => handleActivate(version.id)}
                onDelete={() => handleDelete(version.id)}
              />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-border1 flex items-center justify-between">
          <Button variant="ghost" size="md" onClick={() => setPage(p => p - 1)} disabled={page === 0 || isDeleting}>
            Previous
          </Button>
          <span className="text-xs text-icon3">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="md"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1 || isDeleting}
          >
            Next
          </Button>
        </div>
      )}

      <SaveVersionDialog agentId={agentId} open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen} />
      <VersionCompareDialog agentId={agentId} open={isCompareDialogOpen} onOpenChange={setIsCompareDialogOpen} />
    </div>
  );
}
