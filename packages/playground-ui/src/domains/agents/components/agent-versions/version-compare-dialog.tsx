'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAgentVersions, useCompareAgentVersions } from '../../hooks/use-agent-versions';

interface VersionCompareDialogProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFromVersionId?: string;
  initialToVersionId?: string;
}

interface VersionDiff {
  field: string;
  previousValue: unknown;
  currentValue: unknown;
}

/**
 * Formats a value for display in the diff view.
 * Handles null/undefined, strings, and complex objects (JSON).
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  if (typeof value === 'string') {
    return value || '(empty string)';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  // For arrays and objects, pretty-print JSON
  return JSON.stringify(value, null, 2);
}

/**
 * Determines the change type for a diff entry.
 */
function getChangeType(diff: VersionDiff): 'added' | 'removed' | 'modified' {
  const prevEmpty = diff.previousValue === null || diff.previousValue === undefined;
  const currEmpty = diff.currentValue === null || diff.currentValue === undefined;

  if (prevEmpty && !currEmpty) {
    return 'added';
  }
  if (!prevEmpty && currEmpty) {
    return 'removed';
  }
  return 'modified';
}

/**
 * Single diff row showing the field name and before/after values.
 */
function DiffRow({ diff }: { diff: VersionDiff }) {
  const changeType = getChangeType(diff);
  const previousStr = formatValue(diff.previousValue);
  const currentStr = formatValue(diff.currentValue);
  const isLongContent =
    previousStr.length > 100 || currentStr.length > 100 || previousStr.includes('\n') || currentStr.includes('\n');

  return (
    <div className="p-4 border-b border-border1 last:border-b-0">
      {/* Field name and change type badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-medium text-sm">{diff.field}</span>
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded font-medium',
            changeType === 'added' && 'bg-green-500/20 text-green-400',
            changeType === 'removed' && 'bg-red-500/20 text-red-400',
            changeType === 'modified' && 'bg-yellow-500/20 text-yellow-400',
          )}
        >
          {changeType}
        </span>
      </div>

      {/* Side-by-side diff view */}
      <div className={cn('grid gap-4', isLongContent ? 'grid-cols-1' : 'grid-cols-2')}>
        {/* Previous value */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Previous</p>
          <pre
            className={cn(
              'text-sm p-3 rounded-md bg-surface3 overflow-x-auto whitespace-pre-wrap break-words font-mono',
              changeType === 'added' && 'opacity-50',
              changeType === 'removed' && 'border border-red-500/30 bg-red-500/10',
            )}
          >
            {previousStr}
          </pre>
        </div>

        {/* Current value */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Current</p>
          <pre
            className={cn(
              'text-sm p-3 rounded-md bg-surface3 overflow-x-auto whitespace-pre-wrap break-words font-mono',
              changeType === 'removed' && 'opacity-50',
              changeType === 'added' && 'border border-green-500/30 bg-green-500/10',
              changeType === 'modified' && 'border border-yellow-500/30 bg-yellow-500/10',
            )}
          >
            {currentStr}
          </pre>
        </div>
      </div>
    </div>
  );
}

/**
 * Component to display the diff between two versions.
 */
function VersionDiffView({ diffs }: { diffs: VersionDiff[] }) {
  if (diffs.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No differences between these versions.</div>;
  }

  return (
    <div className="divide-y divide-border1">
      {diffs.map((diff, index) => (
        <DiffRow key={`${diff.field}-${index}`} diff={diff} />
      ))}
    </div>
  );
}

/**
 * Loading skeleton for the diff view.
 */
function DiffSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Dialog component for comparing two agent versions side-by-side.
 * Features:
 * - Dropdown selectors for "from" and "to" versions
 * - Display diff of changed fields with field name, previous value, and current value
 * - Color coding: red for removed, green for added, yellow for changed
 * - Support for JSON diff display for complex fields (model, tools, etc.)
 */
export function VersionCompareDialog({
  agentId,
  open,
  onOpenChange,
  initialFromVersionId,
  initialToVersionId,
}: VersionCompareDialogProps) {
  const [fromVersionId, setFromVersionId] = useState<string>(initialFromVersionId || '');
  const [toVersionId, setToVersionId] = useState<string>(initialToVersionId || '');

  // Fetch all versions for the dropdown selectors
  const { data: versionsData, isLoading: versionsLoading } = useAgentVersions({
    agentId,
    params: { perPage: 100 },
  });

  // Fetch comparison data when both versions are selected
  const { data: compareData, isLoading: compareLoading } = useCompareAgentVersions({
    agentId,
    fromVersionId,
    toVersionId,
  });

  const versions = versionsData?.versions || [];

  // Get version display text
  const getVersionLabel = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return versionId;
    return `v${version.versionNumber}${version.name ? ` - ${version.name}` : ''}`;
  };

  // Get version date for subtitle
  const getVersionDate = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return '';
    return format(new Date(version.createdAt), 'MMM d, yyyy h:mm a');
  };

  const canCompare = fromVersionId && toVersionId && fromVersionId !== toVersionId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
          <DialogDescription>Select two versions to compare their differences.</DialogDescription>
        </DialogHeader>

        {/* Version selectors */}
        <div className="flex items-center gap-4 py-4 border-b border-border1">
          {/* From version selector */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">From (older)</label>
            <Select value={fromVersionId} onValueChange={setFromVersionId} disabled={versionsLoading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select version..." />
              </SelectTrigger>
              <SelectContent>
                {versions.map(version => (
                  <SelectItem key={version.id} value={version.id} disabled={version.id === toVersionId}>
                    <span className="flex flex-col items-start">
                      <span>
                        v{version.versionNumber}
                        {version.name ? ` - ${version.name}` : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(version.createdAt), 'MMM d, yyyy')}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Arrow indicator */}
          <div className="flex items-center justify-center pt-5">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* To version selector */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">To (newer)</label>
            <Select value={toVersionId} onValueChange={setToVersionId} disabled={versionsLoading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select version..." />
              </SelectTrigger>
              <SelectContent>
                {versions.map(version => (
                  <SelectItem key={version.id} value={version.id} disabled={version.id === fromVersionId}>
                    <span className="flex flex-col items-start">
                      <span>
                        v{version.versionNumber}
                        {version.name ? ` - ${version.name}` : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(version.createdAt), 'MMM d, yyyy')}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Version info header when both selected */}
        {canCompare && compareData && (
          <div className="flex items-center gap-4 py-3 px-4 bg-surface2 rounded-md text-sm">
            <div className="flex-1">
              <p className="font-medium">{getVersionLabel(fromVersionId)}</p>
              <p className="text-xs text-muted-foreground">{getVersionDate(fromVersionId)}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{getVersionLabel(toVersionId)}</p>
              <p className="text-xs text-muted-foreground">{getVersionDate(toVersionId)}</p>
            </div>
          </div>
        )}

        {/* Diff content area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!canCompare ? (
            <div className="p-8 text-center text-muted-foreground">
              {versionsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48 mx-auto" />
                  <Skeleton className="h-4 w-32 mx-auto" />
                </div>
              ) : versions.length < 2 ? (
                <p>At least two versions are required to compare.</p>
              ) : (
                <p>Select two different versions to see their differences.</p>
              )}
            </div>
          ) : compareLoading ? (
            <DiffSkeleton />
          ) : (
            <VersionDiffView diffs={(compareData?.diffs as VersionDiff[]) || []} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
