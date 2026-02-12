'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { XIcon, GitCompareIcon, ArrowRightIcon } from 'lucide-react';
import { Button, ButtonWithTooltip } from '@/ds/components/Button';
import { ItemList } from '@/ds/components/ItemList';
import { Checkbox } from '@/ds/components/Checkbox';
import { useDatasetVersions, type DatasetVersion } from '../../hooks/use-dataset-versions';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Column } from '@/ds/components/Columns';

export interface DatasetVersionsPanelProps {
  datasetId: string;
  onClose: () => void;
  onVersionSelect?: (version: DatasetVersion) => void;
  onCompareVersionsClick?: (versionNumbers: string[]) => void;
  activeVersion?: number | null;
}

const versionsListColumns = [{ name: 'version', label: 'Dataset Versions', size: '1fr' }];
const versionsListColumnsWithCheckbox = [{ name: 'checkbox', label: '', size: '.5rem' }, ...versionsListColumns];

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
    if (activeVersion == null) return version.isCurrent;
    return version.version === activeVersion;
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
    <Column withLeftSeparator={true} className="w-[20rem]">
      {isSelectionActive ? (
        <Column.Toolbar className="grid justify-stretch gap-3 w-full">
          <ButtonsGroup>
            <ButtonWithTooltip
              variant="cta"
              size="default"
              disabled={selectedKeys.size !== 2}
              onClick={handleExecuteCompare}
              tooltipContent={selectedKeys.size !== 2 ? 'Select two versions to enable comparison' : undefined}
            >
              <ArrowRightIcon /> Compare Versions
            </ButtonWithTooltip>
            <Button variant="standard" size="default" onClick={handleCancelSelection}>
              Cancel
            </Button>
          </ButtonsGroup>
        </Column.Toolbar>
      ) : (
        <Column.Toolbar>
          <Button variant="standard" size="default" onClick={handleCompareClick}>
            <GitCompareIcon /> Compare
          </Button>
          <Button variant="standard" size="default" onClick={onClose}>
            <XIcon /> Hide
          </Button>
        </Column.Toolbar>
      )}
      <Column.Content>
        {isLoading ? (
          <DatasetVersionsListSkeleton />
        ) : (
          <ItemList className="mr-2">
            <ItemList.Header columns={columnsToRender}>
              {columnsToRender.map(col =>
                col.name === 'checkbox' ? (
                  <ItemList.FlexCell key={col.name}>&nbsp;</ItemList.FlexCell>
                ) : (
                  <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
                ),
              )}
            </ItemList.Header>

            <ItemList.Scroller>
              <ItemList.Items>
                {versions?.map((item, index) => {
                  const key = String(item.version);
                  const createdAtDate = item.createdAt
                    ? typeof item.createdAt === 'string'
                      ? new Date(item.createdAt)
                      : item.createdAt
                    : null;

                  return (
                    <ItemList.Row
                      key={String(item.version)}
                      isSelected={isSelectionActive ? selectedKeys.has(key) : isVersionSelected(item)}
                    >
                      {isSelectionActive && (
                        <ItemList.FlexCell className="w-9 pl-4">
                          <Checkbox
                            checked={selectedKeys.has(key)}
                            onCheckedChange={() => {}}
                            onClick={e => {
                              e.stopPropagation();
                              handleToggleSelection(key);
                            }}
                            aria-label={`Select version ${
                              createdAtDate
                                ? `v${item.version} — ${format(createdAtDate, 'MMM d, yyyy HH:mm')}`
                                : `v${item.version}`
                            }`}
                          />
                        </ItemList.FlexCell>
                      )}
                      <ItemList.RowButton
                        entry={item}
                        columns={versionsListColumns}
                        isSelected={isSelectionActive ? selectedKeys.has(key) : isVersionSelected(item)}
                        onClick={() => handleVersionClick(item)}
                      >
                        <ItemList.FlexCell className="w-full text-neutral flex gap-4 items-baseline text-neutral3">
                          <strong className="min-w-8">v{item.version}</strong>
                          <em>{createdAtDate ? format(createdAtDate, 'MMM d, yyyy HH:mm') : null}</em>
                          {item.isCurrent && (
                            <span className="ml-auto inline-block text-neutral4 text-xs p-1 px-2 leading-none rounded-sm bg-cyan-800">
                              Latest
                            </span>
                          )}
                        </ItemList.FlexCell>
                      </ItemList.RowButton>
                    </ItemList.Row>
                  );
                })}
              </ItemList.Items>
              {hasNextPage && (
                <Button
                  variant="standard"
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
