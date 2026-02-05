'use client';

import { format } from 'date-fns';
import { ItemList } from '@/ds/components/ItemList';
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
        <ItemList>
          <div className="grid grid-rows-[1fr_auto] gap-4">
            <ItemList.Header columns={versionsListColumns}>
              {versionsListColumns.map(col => (
                <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
              ))}
            </ItemList.Header>
          </div>

          <ItemList.Scroller>
            <ItemList.Items>
              {versions?.map((item, index) => {
                const versionDate = typeof item.version === 'string' ? new Date(item.version) : item.version;

                const entry = {
                  id: `version-${index}`,
                  version: format(versionDate, 'MMM d, yyyy HH:mm'),
                  status: item.isLatest ? 'current' : '',
                };

                return (
                  <ItemList.Row key={entry.id} isSelected={isVersionSelected(item)}>
                    <ItemList.RowButton
                      entry={entry}
                      columns={versionsListColumns}
                      isSelected={isVersionSelected(item)}
                      onClick={() => handleVersionClick(item)}
                      className="py-3"
                    >
                      <ItemList.ItemText>
                        <div className="flex gap-2 items-center justify-between w-full text-ui-sm">
                          {entry.version}
                          {item.isDeleted ? (
                            <Badge variant="error">deleted</Badge>
                          ) : (
                            item.isLatest && <Badge>latest</Badge>
                          )}
                        </div>
                      </ItemList.ItemText>
                    </ItemList.RowButton>
                  </ItemList.Row>
                );
              })}
            </ItemList.Items>
          </ItemList.Scroller>
        </ItemList>
      )}
    </div>
  );
}

function DatasetItemVersionsListSkeleton() {
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
