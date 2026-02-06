'use client';

import { format } from 'date-fns';
import { EntryList } from '@/ds/components/EntryList';
import { useDatasetItemVersions, type DatasetItemVersion } from '../../hooks/use-dataset-item-versions';
import { Badge } from '@/ds/components/Badge';

export interface DatasetItemVersionsPanelProps {
  datasetId: string;
  itemId: string;
  onClose: () => void;
  onVersionSelect?: (version: DatasetItemVersion) => void;
  activeVersion?: Date | string | null;
}

const versionsListColumns = [{ name: 'version', label: 'Item Version History', size: '1fr' }];

function getVersionTime(version: Date | string): number {
  return typeof version === 'string' ? new Date(version).getTime() : version.getTime();
}

/**
 * Panel showing dataset item version history.
 */
export function DatasetItemVersionsPanel({
  datasetId,
  itemId,
  onVersionSelect,
  activeVersion,
}: DatasetItemVersionsPanelProps) {
  const { data: versions, isLoading } = useDatasetItemVersions(datasetId, itemId);

  const handleVersionClick = (version: DatasetItemVersion) => {
    onVersionSelect?.(version);
  };

  const isVersionSelected = (version: DatasetItemVersion): boolean => {
    if (!activeVersion) return version.isLatest;
    return getVersionTime(version.version) === getVersionTime(activeVersion);
  };

  return (
    <div className="grid grid-rows-[auto_1fr] h-full min-w-[15rem]">
      {isLoading ? (
        <DatasetItemVersionsListSkeleton />
      ) : (
        <EntryList>
          <EntryList.Trim>
            <EntryList.Header columns={versionsListColumns} />
            <EntryList.Entries>
              {versions?.map((item: DatasetItemVersion, index: number) => {
                const versionDate = typeof item.version === 'string' ? new Date(item.version) : item.version;

                const entry = {
                  id: `version-${index}`,
                  version: format(versionDate, 'MMM d, yyyy HH:mm'),
                  status: item.isLatest ? 'current' : '',
                };

                return (
                  <EntryList.Entry
                    key={entry.id}
                    entry={entry}
                    columns={versionsListColumns}
                    isSelected={isVersionSelected(item)}
                    onClick={() => handleVersionClick(item)}
                  >
                    <EntryList.EntryText>
                      <div className="flex gap-2 items-center justify-between w-full text-ui-sm">
                        {entry.version}
                        {item.isDeleted ? (
                          <Badge variant="error">deleted</Badge>
                        ) : (
                          item.isLatest && <Badge>latest</Badge>
                        )}
                      </div>
                    </EntryList.EntryText>
                  </EntryList.Entry>
                );
              })}
            </EntryList.Entries>
          </EntryList.Trim>
        </EntryList>
      )}
    </div>
  );
}

function DatasetItemVersionsListSkeleton() {
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
