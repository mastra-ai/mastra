'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ScaleIcon, MoveRightIcon } from 'lucide-react';
import { Button, ButtonWithTooltip } from '@/ds/components/Button';
import { ItemList } from '@/ds/components/ItemList';
import { Checkbox } from '@/ds/components/Checkbox';
import { useDatasetItemVersions, type DatasetItemVersion } from '../../hooks/use-dataset-item-versions';
import { Badge } from '@/ds/components/Badge';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Column } from '@/ds/components/Columns';

export interface DatasetItemVersionsPanelProps {
  datasetId: string;
  itemId: string;
  onClose: () => void;
  onVersionSelect?: (version: DatasetItemVersion) => void;
  onCompareVersionsClick?: (versionIds: string[]) => void;
  activeVersion?: Date | string | null;
}

const versionsListColumns = [{ name: 'version', label: 'Item Version History', size: '1fr' }];
const versionsListColumnsWithCheckbox = [{ name: 'checkbox', label: '', size: '1.25rem' }, ...versionsListColumns];

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
  onCompareVersionsClick,
  activeVersion,
}: DatasetItemVersionsPanelProps) {
  const {
    data: versions,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDatasetItemVersions(datasetId, itemId);

  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleVersionClick = (version: DatasetItemVersion) => {
    onVersionSelect?.(version);
  };

  const isVersionSelected = (version: DatasetItemVersion): boolean => {
    if (!activeVersion) return version.isLatest;
    return getVersionTime(version.version) === getVersionTime(activeVersion);
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 2) {
        next.add(id);
      }
      return next;
    });
  };

  const handleCancelSelection = () => {
    setIsSelectionActive(false);
    setSelectedIds(new Set());
  };

  const handleCompareClick = () => {
    setIsSelectionActive(true);
  };

  const handleExecuteCompare = () => {
    if (selectedIds.size === 2 && versions) {
      const selectedVersionNumbers = versions
        .filter(v => selectedIds.has(v.id))
        .map(v => String(v.versionNumber));
      onCompareVersionsClick?.(selectedVersionNumbers);
    }
  };

  const columnsToRender = isSelectionActive ? versionsListColumnsWithCheckbox : versionsListColumns;

  return (
    <Column>
      {isSelectionActive ? (
        <Column.Toolbar>
          <div className="text-sm text-neutral3 flex items-center gap-2">
            <Badge className="text-ui-md">{selectedIds.size}</Badge>
            <span>selected</span>
            <MoveRightIcon />
          </div>
          <ButtonsGroup>
            <ButtonWithTooltip
              variant="standard"
              size="default"
              disabled={selectedIds.size !== 2}
              onClick={handleExecuteCompare}
              tooltipContent={selectedIds.size !== 2 ? 'Select exactly 2 versions to compare' : undefined}
            >
              Compare Versions
            </ButtonWithTooltip>
            <Button variant="secondary" size="default" onClick={handleCancelSelection}>
              Cancel
            </Button>
          </ButtonsGroup>
        </Column.Toolbar>
      ) : (
        <Column.Toolbar>
          <Button variant="secondary" size="default" onClick={handleCompareClick}>
            <ScaleIcon /> Compare
          </Button>
        </Column.Toolbar>
      )}

      {isLoading ? (
        <DatasetItemVersionsListSkeleton />
      ) : (
        <ItemList>
          <div className="grid grid-rows-[1fr_auto] gap-4">
            <ItemList.Header columns={columnsToRender}>
              {columnsToRender.map(col =>
                col.name === 'checkbox' ? (
                  <ItemList.FlexCell key={col.name} />
                ) : (
                  <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
                ),
              )}
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
                  <ItemList.Row key={entry.id} isSelected={isSelectionActive ? selectedIds.has(item.id) : isVersionSelected(item)}>
                    {isSelectionActive && (
                      <ItemList.FlexCell className="w-12 pl-4">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => {}}
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleSelection(item.id);
                          }}
                          aria-label={`Select version ${entry.version}`}
                        />
                      </ItemList.FlexCell>
                    )}
                    <ItemList.RowButton
                      entry={entry}
                      columns={versionsListColumns}
                      isSelected={isSelectionActive ? selectedIds.has(item.id) : isVersionSelected(item)}
                      onClick={() => handleVersionClick(item)}
                      className="py-3"
                    >
                      <ItemList.TextCell>
                        <div className="flex gap-2 items-center justify-between w-full text-ui-sm">
                          {entry.version}
                          {item.isDeleted ? (
                            <Badge variant="error">deleted</Badge>
                          ) : (
                            item.isLatest && <Badge>latest</Badge>
                          )}
                        </div>
                      </ItemList.TextCell>
                    </ItemList.RowButton>
                  </ItemList.Row>
                );
              })}
            </ItemList.Items>
            {hasNextPage && (
              <Button
                variant="secondary"
                size="default"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full mt-2"
              >
                {isFetchingNextPage ? 'Loading...' : 'Load More'}
              </Button>
            )}
          </ItemList.Scroller>
        </ItemList>
      )}
    </Column>
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
                <ItemList.TextCell key={colIndex} isLoading>
                  Loading...
                </ItemList.TextCell>
              ))}
            </ItemList.RowButton>
          </ItemList.Row>
        ))}
      </ItemList.Items>
    </ItemList>
  );
}
