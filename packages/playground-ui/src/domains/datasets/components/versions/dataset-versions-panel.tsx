'use client';

import { format } from 'date-fns';
import { XIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { ItemList } from '@/ds/components/ItemList';
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
        <Button variant="secondary" size="default" onClick={onClose}>
          <XIcon />
          Hide Versions History
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto rounded-lg">
        {isLoading ? (
          <DatasetVersionsListSkeleton />
        ) : (
          <ItemList>
            <ItemList.Header columns={versionsListColumns}>
              {versionsListColumns.map(col => (
                <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
              ))}
            </ItemList.Header>

            <ItemList.Scroller>
              <ItemList.Items>
                {versions?.map((item, index) => {
                  const versionDate = typeof item.version === 'string' ? new Date(item.version) : item.version;

                  const entry = {
                    id: `version-${index}`,
                    version: format(versionDate, 'MMM d, yyyy HH:mm'),
                    status: item.isCurrent ? 'current' : '',
                  };

                  return (
                    <ItemList.Row key={entry.id} isSelected={isVersionSelected(item)}>
                      <ItemList.RowButton
                        entry={entry}
                        columns={versionsListColumns}
                        isSelected={isVersionSelected(item)}
                        onClick={() => handleVersionClick(item)}
                      >
                        <ItemList.ItemText>{entry.version}</ItemList.ItemText>
                      </ItemList.RowButton>
                    </ItemList.Row>
                  );
                })}
              </ItemList.Items>
            </ItemList.Scroller>
          </ItemList>
        )}
      </div>
    </div>
  );
}

function DatasetVersionsListSkeleton() {
  return (
    <ItemList>
      <ItemList.Header columns={versionsListColumns} />
      <ItemList.Items>
        {Array.from({ length: 3 }).map((_, index) => (
          <ItemList.Row key={index}>
            <ItemList.RowButton columns={versionsListColumns}>
              {versionsListColumns.map((col, colIndex) => (
                <ItemList.ItemText key={colIndex} isLoading>
                  Loading...
                </ItemList.ItemText>
              ))}
            </ItemList.RowButton>
          </ItemList.Row>
        ))}
      </ItemList.Items>
    </ItemList>
  );
}
