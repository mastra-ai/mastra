'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { GitCompareIcon } from 'lucide-react';
import { Button, ButtonWithTooltip } from '@/ds/components/Button';
import { ItemList } from '@/ds/components/ItemList';
import { Checkbox } from '@/ds/components/Checkbox';
import { useDatasetItemVersions, type DatasetItemVersion } from '../../hooks/use-dataset-item-versions';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Column } from '@/ds/components/Columns';

export interface DatasetItemVersionsPanelProps {
  datasetId: string;
  itemId: string;
  onClose: () => void;
  onVersionSelect?: (version: DatasetItemVersion) => void;
  onCompareVersionsClick?: (versionIds: string[]) => void;
  activeVersion?: number | null;
}

const versionsListColumns = [{ name: 'version', label: 'Item Version History', size: '1fr' }];
const versionsListColumnsWithCheckbox = [{ name: 'checkbox', label: '', size: '1.25rem' }, ...versionsListColumns];

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
  const { data: versions, isLoading } = useDatasetItemVersions(datasetId, itemId);

  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleVersionClick = (version: DatasetItemVersion) => {
    onVersionSelect?.(version);
  };

  const isVersionSelected = (version: DatasetItemVersion): boolean => {
    if (activeVersion == null) return version.isLatest;
    return version.datasetVersion === activeVersion;
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
    if (selectedIds.size === 2) {
      onCompareVersionsClick?.([...selectedIds]);
    }
  };

  const columnsToRender = isSelectionActive ? versionsListColumnsWithCheckbox : versionsListColumns;

  return (
    <Column className="min-w-[17rem]">
      {isSelectionActive ? (
        <Column.Toolbar className="grid justify-stretch gap-3 w-full">
          <ButtonsGroup>
            <Button variant="standard" size="default" onClick={handleCancelSelection}>
              Cancel
            </Button>
            <ButtonWithTooltip
              variant="cta"
              size="default"
              disabled={selectedIds.size !== 2}
              onClick={handleExecuteCompare}
              tooltipContent={selectedIds.size !== 2 ? 'Check 2 versions to compare' : undefined}
              className="grow"
            >
              Compare Selected
            </ButtonWithTooltip>
          </ButtonsGroup>
        </Column.Toolbar>
      ) : (
        <Column.Toolbar>
          <Button variant="standard" size="default" onClick={handleCompareClick} className="w-full">
            <GitCompareIcon /> Compare Versions
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
                const versionKey = String(item.datasetVersion);
                const versionDate = typeof item.updatedAt === 'string' ? new Date(item.updatedAt) : item.updatedAt;

                return (
                  <ItemList.Row
                    key={String(item.datasetVersion)}
                    isSelected={isSelectionActive ? selectedIds.has(versionKey) : isVersionSelected(item)}
                  >
                    {isSelectionActive && (
                      <ItemList.FlexCell className="w-12 pl-4">
                        <Checkbox
                          checked={selectedIds.has(versionKey)}
                          disabled={item.isDeleted}
                          onCheckedChange={() => {}}
                          onClick={e => {
                            e.stopPropagation();
                            if (!item.isDeleted) {
                              handleToggleSelection(versionKey);
                            }
                          }}
                          aria-label={`Select version ${item.datasetVersion}`}
                        />
                      </ItemList.FlexCell>
                    )}
                    <ItemList.RowButton
                      entry={item}
                      columns={versionsListColumns}
                      isSelected={isSelectionActive ? selectedIds.has(versionKey) : isVersionSelected(item)}
                      onClick={() => handleVersionClick(item)}
                      className="py-3"
                    >
                      <ItemList.FlexCell className="w-full text-neutral grid text-neutral3">
                        <div className="flex">
                          <strong className="min-w-11">v{item.datasetVersion}</strong>
                          <em>{versionDate ? format(versionDate, 'MMM d, yyyy HH:mm') : null}</em>
                        </div>
                        {(item.isLatest || item.isDeleted) && (
                          <div className="flex gap-2 pl-11  ">
                            {item.isLatest && (
                              <span className="inline-block text-neutral4 text-xs p-1 px-2 leading-none rounded-sm bg-cyan-900">
                                Latest
                              </span>
                            )}
                            {item.isDeleted && (
                              <span className="inline-block text-neutral4 text-xs p-1 px-2 leading-none rounded-sm bg-red-900">
                                Deleted
                              </span>
                            )}
                          </div>
                        )}
                      </ItemList.FlexCell>
                    </ItemList.RowButton>
                  </ItemList.Row>
                );
              })}
            </ItemList.Items>
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
