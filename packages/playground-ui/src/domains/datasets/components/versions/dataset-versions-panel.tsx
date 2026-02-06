'use client';

import { format } from 'date-fns';
import { XIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { EntryList } from '@/ds/components/EntryList';
import { useDatasetVersions, type DatasetVersion } from '../../hooks/use-dataset-versions';

export interface DatasetVersionsPanelProps {
  datasetId: string;
  onClose: () => void;
  onVersionSelect?: (version: DatasetVersion) => void;
  activeVersion?: Date | string | null;
}

const versionsListColumns = [{ name: 'version', label: 'Dataset Versions', size: '1fr' }];

function getVersionTime(version: Date | string): number {
  return typeof version === 'string' ? new Date(version).getTime() : version.getTime();
}

/**
 * Panel showing dataset version history.
 */
export function DatasetVersionsPanel({
  datasetId,
  onClose,
  onVersionSelect,
  activeVersion,
}: DatasetVersionsPanelProps) {
  const { data: versions, isLoading } = useDatasetVersions(datasetId);

  const handleVersionClick = (version: DatasetVersion) => {
    onVersionSelect?.(version);
  };

  const isVersionSelected = (version: DatasetVersion): boolean => {
    if (!activeVersion) return version.isCurrent;
    return getVersionTime(version.version) === getVersionTime(activeVersion);
  };

  return (
    <div className="grid grid-rows-[auto_auto_1fr] h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Button variant="outline" size="md" onClick={onClose}>
          <XIcon />
          Hide Versions History
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto rounded-lg">
        {isLoading ? (
          <DatasetVersionsListSkeleton />
        ) : (
          <EntryList>
            <EntryList.Trim>
              <EntryList.Header columns={versionsListColumns} />
              <EntryList.Entries>
                {versions?.map((item: DatasetVersion, index: number) => {
                  const versionDate = typeof item.version === 'string' ? new Date(item.version) : item.version;

                  const entry = {
                    id: `version-${index}`,
                    version: format(versionDate, 'MMM d, yyyy HH:mm'),
                    status: item.isCurrent ? 'current' : '',
                  };

                  return (
                    <EntryList.Entry
                      key={entry.id}
                      entry={entry}
                      columns={versionsListColumns}
                      isSelected={isVersionSelected(item)}
                      onClick={() => handleVersionClick(item)}
                    >
                      <EntryList.EntryText>{entry.version}</EntryList.EntryText>
                    </EntryList.Entry>
                  );
                })}
              </EntryList.Entries>
            </EntryList.Trim>
          </EntryList>
        )}
      </div>
    </div>
  );
}

function DatasetVersionsListSkeleton() {
  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={versionsListColumns} />
        <EntryList.Entries>
          {Array.from({ length: 3 }).map((_: unknown, index: number) => (
            <EntryList.Entry key={index} columns={versionsListColumns}>
              {versionsListColumns.map((_col: { name: string; label: string; size: string }, colIndex: number) => (
                <EntryList.EntryText key={colIndex} isLoading>
                  Loading...
                </EntryList.EntryText>
              ))}
            </EntryList.Entry>
          ))}
        </EntryList.Entries>
      </EntryList.Trim>
    </EntryList>
  );
}
