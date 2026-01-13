# Worker D: Version UI

> **Role**: All versioning UI components  
> **Priority**: MEDIUM - Depends on Worker C backend  
> **Estimated Time**: 6-8 hours

---

## Overview

Worker D builds all the UI components for agent versioning: version list, save dialog, compare dialog, and integration into the agent information panel.

---

## Dependencies

- **Worker C (V8)**: Need client SDK version methods for hooks
- **Worker A (Task 1)**: Need `source` field to show versions tab only for stored agents

**Can start immediately**: V10, V11 UI shells (no backend dependency for layout)

---

## Tasks

### Task V9: Create Version Hooks

**Priority**: HIGH  
**Depends on**: Worker C (V8)

**New file**: `packages/playground-ui/src/domains/agents/hooks/use-agent-versions.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type { ListAgentVersionsParams, CreateAgentVersionParams } from '@mastra/client-js';

export const useAgentVersions = (agentId: string, params?: ListAgentVersionsParams) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['agent-versions', agentId, params],
    queryFn: () => client.getStoredAgent(agentId).listVersions(params, requestContext),
    enabled: !!agentId,
  });
};

export const useAgentVersion = (agentId: string, versionId: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['agent-version', agentId, versionId],
    queryFn: () => client.getStoredAgent(agentId).getVersion(versionId, requestContext),
    enabled: !!agentId && !!versionId,
  });
};

export const useCreateAgentVersion = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: (params?: CreateAgentVersionParams) =>
      client.getStoredAgent(agentId).createVersion(params, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

export const useActivateAgentVersion = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).activateVersion(versionId, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

export const useRestoreAgentVersion = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).restoreVersion(versionId, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

export const useDeleteAgentVersion = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: (versionId: string) => client.getStoredAgent(agentId).deleteVersion(versionId, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
    },
  });
};

export const useCompareAgentVersions = (agentId: string, fromId: string, toId: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['agent-versions-compare', agentId, fromId, toId],
    queryFn: () => client.getStoredAgent(agentId).compareVersions(fromId, toId, requestContext),
    enabled: !!agentId && !!fromId && !!toId,
  });
};
```

---

### Task V10: Create AgentVersions List Component

**Priority**: HIGH  
**Can start immediately** (UI shell, wire up hooks later)

**New file**: `packages/playground-ui/src/domains/agents/components/agent-versions/agent-versions.tsx`

```typescript
import { useState } from 'react';
import { useAgentVersions, useActivateAgentVersion, useDeleteAgentVersion } from '../../hooks/use-agent-versions';
import { VersionListItem } from './version-list-item';
import { SaveVersionDialog } from './save-version-dialog';
import { VersionCompareDialog } from './version-compare-dialog';
import { Button } from '@/ds/components/Button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';

interface AgentVersionsProps {
  agentId: string;
  activeVersionId?: string;
}

export function AgentVersions({ agentId, activeVersionId }: AgentVersionsProps) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [compareVersions, setCompareVersions] = useState<{ from: string; to: string } | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<string | null>(null);

  const { data, isLoading } = useAgentVersions(agentId);
  const { mutate: activateVersion } = useActivateAgentVersion(agentId);
  const { mutate: deleteVersion } = useDeleteAgentVersion(agentId);

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

  const versions = data?.versions || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border1 flex items-center justify-between">
        <h3 className="text-sm font-medium">Versions</h3>
        <Button size="sm" onClick={() => setIsSaveDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Save Version
        </Button>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p>No versions saved yet.</p>
            <p className="text-sm mt-1">Save a version to track changes over time.</p>
          </div>
        ) : (
          <div className="divide-y divide-border1">
            {versions.map((version) => (
              <VersionListItem
                key={version.id}
                version={version}
                isActive={version.id === activeVersionId}
                isSelectedForCompare={selectedForCompare === version.id}
                onActivate={() => activateVersion(version.id)}
                onDelete={() => deleteVersion(version.id)}
                onCompare={() => {
                  if (selectedForCompare && selectedForCompare !== version.id) {
                    setCompareVersions({ from: selectedForCompare, to: version.id });
                    setSelectedForCompare(null);
                  } else {
                    setSelectedForCompare(version.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <SaveVersionDialog
        agentId={agentId}
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
      />

      {compareVersions && (
        <VersionCompareDialog
          agentId={agentId}
          fromVersionId={compareVersions.from}
          toVersionId={compareVersions.to}
          open={true}
          onOpenChange={(open) => !open && setCompareVersions(null)}
        />
      )}
    </div>
  );
}
```

**New file**: `packages/playground-ui/src/domains/agents/components/agent-versions/version-list-item.tsx`

```typescript
import { format } from 'date-fns';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, MoreHorizontal, GitCompare, RotateCcw, Trash2 } from 'lucide-react';
import type { AgentVersionResponse } from '@mastra/client-js';

interface VersionListItemProps {
  version: AgentVersionResponse;
  isActive: boolean;
  isSelectedForCompare: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onCompare: () => void;
  onRestore?: () => void;
}

export function VersionListItem({
  version,
  isActive,
  isSelectedForCompare,
  onActivate,
  onDelete,
  onCompare,
  onRestore,
}: VersionListItemProps) {
  return (
    <div className={`p-4 hover:bg-surface2 ${isSelectedForCompare ? 'bg-surface3' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Version number and status */}
          <div className="flex items-center gap-2">
            <span className="font-medium">v{version.versionNumber}</span>
            {isActive && (
              <Badge variant="default" className="text-xs">
                <Check className="w-3 h-3 mr-1" />
                Active
              </Badge>
            )}
            {isSelectedForCompare && (
              <Badge variant="outline" className="text-xs">
                Selected for compare
              </Badge>
            )}
          </div>

          {/* Vanity name */}
          {version.name && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {version.name}
            </p>
          )}

          {/* Changed fields */}
          {version.changedFields && version.changedFields.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Changed: {version.changedFields.join(', ')}
            </p>
          )}

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(version.createdAt), 'MMM d, yyyy h:mm a')}
          </p>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCompare}>
              <GitCompare className="w-4 h-4 mr-2" />
              {isSelectedForCompare ? 'Cancel Compare' : 'Compare'}
            </DropdownMenuItem>
            {!isActive && (
              <>
                <DropdownMenuItem onClick={onActivate}>
                  <Check className="w-4 h-4 mr-2" />
                  Activate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRestore}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore
                </DropdownMenuItem>
              </>
            )}
            {!isActive && (
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

---

### Task V11: Create SaveVersionDialog Component

**Priority**: HIGH  
**Can start immediately** (UI shell)

**New file**: `packages/playground-ui/src/domains/agents/components/agent-versions/save-version-dialog.tsx`

```typescript
import { useState } from 'react';
import { useCreateAgentVersion } from '../../hooks/use-agent-versions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/ds/components/Button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface SaveVersionDialogProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changedFields?: string[];  // Show what changed from previous
}

export function SaveVersionDialog({
  agentId,
  open,
  onOpenChange,
  changedFields,
}: SaveVersionDialogProps) {
  const [name, setName] = useState('');
  const [changeMessage, setChangeMessage] = useState('');

  const { mutateAsync: createVersion, isPending } = useCreateAgentVersion(agentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createVersion({
      name: name.trim() || undefined,
      changeMessage: changeMessage.trim() || undefined,
    });
    setName('');
    setChangeMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Version</DialogTitle>
          <DialogDescription>
            Create a snapshot of the current agent configuration.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="version-name">Version Name (optional)</Label>
            <Input
              id="version-name"
              placeholder="e.g., Production v1, Experiment with GPT-4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-message">Description (optional)</Label>
            <Textarea
              id="change-message"
              placeholder="What changed in this version?"
              value={changeMessage}
              onChange={(e) => setChangeMessage(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          {changedFields && changedFields.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Changes from previous version:</p>
              <ul className="list-disc list-inside">
                {changedFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Version'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Task V12: Create VersionCompareDialog with Diff View

**Priority**: MEDIUM  
**Depends on**: V9 (hooks)

**New file**: `packages/playground-ui/src/domains/agents/components/agent-versions/version-compare-dialog.tsx`

```typescript
import { useCompareAgentVersions } from '../../hooks/use-agent-versions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VersionDiffView } from './version-diff-view';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface VersionCompareDialogProps {
  agentId: string;
  fromVersionId: string;
  toVersionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionCompareDialog({
  agentId,
  fromVersionId,
  toVersionId,
  open,
  onOpenChange,
}: VersionCompareDialogProps) {
  const { data, isLoading } = useCompareAgentVersions(agentId, fromVersionId, toVersionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
          {data && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                v{data.fromVersion.versionNumber}
                {data.fromVersion.name && ` (${data.fromVersion.name})`}
                <br />
                <span className="text-xs">
                  {format(new Date(data.fromVersion.createdAt), 'MMM d, yyyy')}
                </span>
              </span>
              <span>→</span>
              <span>
                v{data.toVersion.versionNumber}
                {data.toVersion.name && ` (${data.toVersion.name})`}
                <br />
                <span className="text-xs">
                  {format(new Date(data.toVersion.createdAt), 'MMM d, yyyy')}
                </span>
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : data?.diffs.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No differences between these versions.
            </div>
          ) : (
            <VersionDiffView diffs={data?.diffs || []} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**New file**: `packages/playground-ui/src/domains/agents/components/agent-versions/version-diff-view.tsx`

```typescript
import type { AgentVersionDiff } from '@mastra/client-js';
import { cn } from '@/lib/utils';

interface VersionDiffViewProps {
  diffs: AgentVersionDiff[];
}

export function VersionDiffView({ diffs }: VersionDiffViewProps) {
  return (
    <div className="divide-y divide-border1">
      {diffs.map((diff, index) => (
        <DiffRow key={`${diff.field}-${index}`} diff={diff} />
      ))}
    </div>
  );
}

function DiffRow({ diff }: { diff: AgentVersionDiff }) {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  };

  const previousStr = formatValue(diff.previousValue);
  const currentStr = formatValue(diff.currentValue);

  // Determine change type
  const isAdded = diff.previousValue === null || diff.previousValue === undefined;
  const isRemoved = diff.currentValue === null || diff.currentValue === undefined;
  const isModified = !isAdded && !isRemoved;

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-sm">{diff.field}</span>
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            isAdded && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            isRemoved && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            isModified && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          )}
        >
          {isAdded ? 'added' : isRemoved ? 'removed' : 'modified'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Previous value */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Previous</p>
          <pre
            className={cn(
              'text-sm p-2 rounded bg-surface3 overflow-x-auto whitespace-pre-wrap',
              isAdded && 'opacity-50'
            )}
          >
            {previousStr}
          </pre>
        </div>

        {/* Current value */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Current</p>
          <pre
            className={cn(
              'text-sm p-2 rounded bg-surface3 overflow-x-auto whitespace-pre-wrap',
              isRemoved && 'opacity-50'
            )}
          >
            {currentStr}
          </pre>
        </div>
      </div>
    </div>
  );
}
```

---

### Task V13: Add "Versions" Tab to AgentInformation

**Priority**: HIGH  
**Depends on**: V10

**File**: `packages/playground-ui/src/domains/agents/components/agent-information/agent-information.tsx`

**Changes**:

```typescript
import { AgentVersions } from '../agent-versions';

export function AgentInformation({ agentId, threadId }: AgentInformationProps) {
  const { data: agent } = useAgent(agentId);
  const { data: memory } = useMemory(agentId);
  const hasMemory = Boolean(memory?.result);
  const isStoredAgent = agent?.source === 'stored';

  return (
    <AgentInformationLayout agentId={agentId}>
      <AgentEntityHeader agentId={agentId} />

      <AgentInformationTabLayout agentId={agentId}>
        <TabList>
          <Tab value="overview">Overview</Tab>
          <Tab value="model-settings">Model Settings</Tab>
          {hasMemory && <Tab value="memory">Memory</Tab>}
          {isStoredAgent && <Tab value="versions">Versions</Tab>}  {/* ADD */}
          <Tab value="tracing-options">Tracing Options</Tab>
        </TabList>
        <TabContent value="overview">
          <AgentMetadata agentId={agentId} />
        </TabContent>
        <TabContent value="model-settings">
          <AgentSettings agentId={agentId} />
        </TabContent>
        {hasMemory && (
          <TabContent value="memory">
            <AgentMemory agentId={agentId} threadId={threadId} />
          </TabContent>
        )}
        {isStoredAgent && (  {/* ADD */}
          <TabContent value="versions">
            <AgentVersions
              agentId={agentId}
              activeVersionId={agent?.activeVersionId}
            />
          </TabContent>
        )}
        <TabContent value="tracing-options">
          <TracingRunOptions />
        </TabContent>
      </AgentInformationTabLayout>
    </AgentInformationLayout>
  );
}
```

---

### Task V14: Add Version Badge to AgentEntityHeader

**Priority**: LOW  
**Depends on**: V9

**File**: `packages/playground-ui/src/domains/agents/components/agent-entity-header.tsx`

**Add version badge** for stored agents:

```typescript
import { useAgentVersions } from '../hooks/use-agent-versions';

export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const isStoredAgent = agent?.source === 'stored';

  // Only fetch versions for stored agents
  const { data: versionsData } = useAgentVersions(agentId, { perPage: 1 }, {
    enabled: isStoredAgent,
  });

  const activeVersion = versionsData?.versions?.find(v => v.id === agent?.activeVersionId);

  return (
    <TooltipProvider>
      <EntityHeader icon={<AgentIcon />} title={agentName} isLoading={isLoading}>
        {/* Existing ID badge */}
        <Tooltip>...</Tooltip>

        {/* Version badge - only for stored agents with versions */}
        {isStoredAgent && activeVersion && (
          <Badge variant="outline">
            v{activeVersion.versionNumber}
            {activeVersion.name && ` · ${activeVersion.name}`}
          </Badge>
        )}

        {/* Edit button - existing from Worker B/E */}
        {isStoredAgent && (
          <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
            Edit
          </Button>
        )}
      </EntityHeader>
      ...
    </TooltipProvider>
  );
};
```

---

### Task V15: Implement Retention Enforcement (UI feedback)

**Priority**: LOW

This is primarily a backend task (Worker C), but the UI should handle:

- Show warning when approaching version limit
- Show notification when old versions are auto-deleted

**In AgentVersions component**:

```typescript
// Show warning if approaching limit
{data?.total >= 45 && (
  <div className="px-4 py-2 bg-yellow-50 text-yellow-800 text-sm">
    Approaching version limit ({data.total}/50). Oldest versions may be auto-deleted.
  </div>
)}
```

---

## New Directory Structure

```
packages/playground-ui/src/domains/agents/components/agent-versions/
├── index.tsx                    # Barrel exports
├── agent-versions.tsx           # V10 - Main list component
├── version-list-item.tsx        # V10 - List item
├── save-version-dialog.tsx      # V11
├── version-compare-dialog.tsx   # V12
└── version-diff-view.tsx        # V12
```

---

## File Ownership

Worker D owns exclusively:

- `packages/playground-ui/src/domains/agents/components/agent-versions/*` (all new)
- `packages/playground-ui/src/domains/agents/hooks/use-agent-versions.ts` (new)

Worker D modifies (coordinate with Worker E):

- `packages/playground-ui/src/domains/agents/components/agent-information/agent-information.tsx`
- `packages/playground-ui/src/domains/agents/components/agent-entity-header.tsx`

---

## Handoff

**From Worker C**:

- Wait for V8 (client SDK) before completing V9 (hooks)

**To Worker E**:

- After V13, V14, Worker E can verify page integration works

---

## Testing Checklist

- [ ] Versions tab appears only for stored agents
- [ ] Version list loads and displays correctly
- [ ] "Save Version" dialog creates new version
- [ ] Version name and message are saved
- [ ] Activate version works
- [ ] Restore version creates new version
- [ ] Delete version works (cannot delete active)
- [ ] Compare dialog shows side-by-side diff
- [ ] Diff view highlights added/removed/modified
- [ ] Version badge shows in header
- [ ] Retention warning appears when approaching limit
