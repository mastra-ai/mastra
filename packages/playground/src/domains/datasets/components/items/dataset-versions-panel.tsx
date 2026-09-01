'use client';

import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import {
  ThreadList,
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
} from '@mastra/playground-ui/components/ThreadList';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { format } from 'date-fns';
import { GitCompareIcon, ArrowRightIcon } from 'lucide-react';
import { useState } from 'react';
import { useDatasetVersions } from '../../hooks/use-dataset-versions';
import type { DatasetVersion } from '../../hooks/use-dataset-versions';

export interface DatasetVersionsPanelProps {
  datasetId: string;
  onVersionSelect?: (version: DatasetVersion) => void;
  onCompareVersionsClick?: (versionNumbers: string[]) => void;
  activeVersion?: number | null;
}

/**
 * Panel showing dataset version history with optional compare selection.
 */
export function DatasetVersionsPanel({
  datasetId,
  onVersionSelect,
  onCompareVersionsClick,
  activeVersion,
}: DatasetVersionsPanelProps) {
  const { data: versions, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useDatasetVersions(datasetId);

  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const isVersionSelected = (version: DatasetVersion): boolean => {
    if (activeVersion == null) return version.isCurrent;
    return version.version === activeVersion;
  };

  const handleToggleSelection = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size >= 2) {
        // Drop most recent selection, keep oldest + add new one
        const [first] = Array.from(next);
        return new Set([first, key]);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCancelSelection = () => {
    setIsSelectionActive(false);
    setSelectedKeys(new Set());
  };

  const handleExecuteCompare = () => {
    if (selectedKeys.size === 2) {
      onCompareVersionsClick?.(Array.from(selectedKeys));
    }
  };

  return (
    <div className="border-border1 grid w-64 grid-rows-[auto_1fr] gap-2 overflow-hidden border-l pt-3 pl-3">
      <div className="flex items-center justify-between gap-2 pr-1 pl-2">
        <Txt as="h2" variant="ui-md" className="text-neutral3">
          Versions
        </Txt>
        {isSelectionActive ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleCancelSelection}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={selectedKeys.size !== 2}
              onClick={handleExecuteCompare}
              tooltip={selectedKeys.size !== 2 ? 'Select two versions to enable comparison' : undefined}
            >
              <ArrowRightIcon /> Compare
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setIsSelectionActive(true)}>
            <GitCompareIcon /> Compare
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid content-start gap-1 px-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-9" />
          ))}
        </div>
      ) : (
        <ThreadList aria-label="Dataset versions" embedded>
          {!versions?.length ? (
            <ThreadListEmpty>Dataset versions will appear here</ThreadListEmpty>
          ) : (
            <ThreadListItems>
              {versions.map(item => {
                const key = String(item.version);
                const createdAtDate = item.createdAt
                  ? typeof item.createdAt === 'string'
                    ? new Date(item.createdAt)
                    : item.createdAt
                  : null;

                return (
                  <ThreadListItem
                    key={key}
                    isActive={isSelectionActive ? selectedKeys.has(key) : isVersionSelected(item)}
                    onClick={() => (isSelectionActive ? handleToggleSelection(key) : onVersionSelect?.(item))}
                  >
                    <span className="flex w-full min-w-0 items-center gap-2.5">
                      {/* Checkbox is purely visual — the row button handles toggling. Making it
                          interactive causes a double toggle (checkbox + row click). */}
                      {isSelectionActive && (
                        <Checkbox
                          checked={selectedKeys.has(key)}
                          tabIndex={-1}
                          className="pointer-events-none"
                          aria-hidden="true"
                        />
                      )}
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-xs">
                        <span className="text-neutral5 shrink-0 font-medium">v.{item.version}</span>
                        {createdAtDate && (
                          <span className="text-neutral3 min-w-0 flex-1 truncate">
                            {format(createdAtDate, 'MMM d, yyyy HH:mm')}
                          </span>
                        )}
                        {item.isCurrent && <span className="text-neutral3 shrink-0">latest</span>}
                      </span>
                    </span>
                  </ThreadListItem>
                );
              })}
              {hasNextPage && (
                <li>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="w-full"
                  >
                    {isFetchingNextPage ? 'Loading...' : 'Load More'}
                  </Button>
                </li>
              )}
            </ThreadListItems>
          )}
        </ThreadList>
      )}
    </div>
  );
}
