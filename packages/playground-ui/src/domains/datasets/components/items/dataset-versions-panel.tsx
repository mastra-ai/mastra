'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { XIcon, ScaleIcon, MoveRightIcon } from 'lucide-react';
import { Button, ButtonWithTooltip } from '@/ds/components/Button';
import { ItemList } from '@/ds/components/ItemList';
import { Checkbox } from '@/ds/components/Checkbox';
import { useDatasetVersions, type DatasetVersion } from '../../hooks/use-dataset-versions';
import { Badge } from '@/ds/components/Badge';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Column } from '@/ds/components/Columns';

export interface DatasetVersionsPanelProps {
  datasetId: string;
  onClose: () => void;
  onVersionSelect?: (version: DatasetVersion) => void;
  onCompareVersionsClick?: (versionTimestamps: string[]) => void;
  activeVersion?: Date | string | null;
}

const versionsListColumns = [{ name: 'version', label: 'Dataset Versions', size: '1fr' }];
const versionsListColumnsWithCheckbox = [{ name: 'checkbox', label: '', size: '1.25rem' }, ...versionsListColumns];

function getVersionTime(version: Date | string): number {
  return typeof version === 'string' ? new Date(version).getTime() : version.getTime();
}

function getVersionKey(version: DatasetVersion): string {
  return typeof version.version === 'string' ? version.version : version.version.toISOString();
}

/**
 * Panel showing dataset version history with optional compare selection.
 */
export function DatasetVersionsPanel({
  datasetId,
  onClose,
  onVersionSelect,
  onCompareVersionsClick,
  activeVersion,
}: DatasetVersionsPanelProps) {
  const { data: versions, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useDatasetVersions(datasetId);

  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const handleVersionClick = (version: DatasetVersion) => {
    onVersionSelect?.(version);
  };

  const isVersionSelected = (version: DatasetVersion): boolean => {
    if (!activeVersion) return version.isCurrent;
    return getVersionTime(version.version) === getVersionTime(activeVersion);
  };

  const handleToggleSelection = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < 2) {
        next.add(key);
      }
      return next;
    });
  };

  const handleCancelSelection = () => {
    setIsSelectionActive(false);
    setSelectedKeys(new Set());
  };

  const handleCompareClick = () => {
    setIsSelectionActive(true);
  };

  const handleExecuteCompare = () => {
    if (selectedKeys.size === 2) {
      onCompareVersionsClick?.(Array.from(selectedKeys));
    }
  };

  const columnsToRender = isSelectionActive ? versionsListColumnsWithCheckbox : versionsListColumns;

  return (
    <Column withLeftSeparator={true}>
      {isSelectionActive ? (
        <Column.Toolbar>
          <div className="text-sm text-neutral3 flex items-center gap-2">
            <Badge className="text-ui-md">{selectedKeys.size}</Badge>
            <span>selected</span>
            <MoveRightIcon />
          </div>
          <ButtonsGroup>
            <ButtonWithTooltip
              variant="standard"
              size="default"
              disabled={selectedKeys.size !== 2}
              onClick={handleExecuteCompare}
              tooltipContent={selectedKeys.size !== 2 ? 'Select exactly 2 versions to compare' : undefined}
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
          <Button variant="secondary" size="default" onClick={onClose}>
            <XIcon />
            Hide Versions History
          </Button>
          <Button variant="secondary" size="default" onClick={handleCompareClick}>
            <ScaleIcon /> Compare
          </Button>
        </Column.Toolbar>
      )}

      <Column.Content>
        {isLoading ? (
          <DatasetVersionsListSkeleton />
        ) : (
          <ItemList>
            <div className="grid grid-rows-[1fr_auto] gap-4">
              <ItemList.Header columns={columnsToRender}>
                {columnsToRender.map(col =>
                  col.name === 'checkbox' ? (
                    <ItemList.FlexCell key={col.name}>.</ItemList.FlexCell>
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
                  const key = getVersionKey(item);

                  const entry = {
                    id: `version-${index}`,
                    version: format(versionDate, 'MMM d, yyyy HH:mm'),
                    status: item.isCurrent ? 'current' : '',
                  };

                  return (
                    <ItemList.Row
                      key={entry.id}
                      isSelected={isSelectionActive ? selectedKeys.has(key) : isVersionSelected(item)}
                    >
                      {isSelectionActive && (
                        <ItemList.FlexCell className="w-12 pl-4">
                          <Checkbox
                            checked={selectedKeys.has(key)}
                            onCheckedChange={() => {}}
                            onClick={e => {
                              e.stopPropagation();
                              handleToggleSelection(key);
                            }}
                            aria-label={`Select version ${entry.version}`}
                          />
                        </ItemList.FlexCell>
                      )}
                      <ItemList.RowButton
                        entry={entry}
                        columns={versionsListColumns}
                        isSelected={isSelectionActive ? selectedKeys.has(key) : isVersionSelected(item)}
                        onClick={() => handleVersionClick(item)}
                        className="py-3"
                      >
                        <ItemList.TextCell>
                          <div className="flex gap-2 items-center justify-between w-full text-ui-sm">
                            {entry.version}
                            {item.isCurrent && <Badge>current</Badge>}
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
      </Column.Content>
    </Column>
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
