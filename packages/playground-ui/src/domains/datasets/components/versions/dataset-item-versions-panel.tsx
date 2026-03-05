'use client';

import { useState } from 'react';
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
      } else if (next.size >= 2) {
        // Drop most recent selection, keep oldest + add new one
        const [first] = Array.from(next);
        return new Set([first, id]);
      } else {
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

  return (
    <Column className="min-w-[14rem]">
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
              Compare
            </ButtonWithTooltip>
          </ButtonsGroup>
        </Column.Toolbar>
      ) : (
        <>
          {(versions || []).length > 1 && (
            <Column.Toolbar>
              <Button variant="standard" size="default" onClick={handleCompareClick} className="w-full">
                <GitCompareIcon /> Compare Ver.
              </Button>
            </Column.Toolbar>
          )}
        </>
      )}

      {isLoading ? (
        <DatasetItemVersionsListSkeleton />
      ) : (
        <ItemList>
          <ItemList.Header>
            <ItemList.HeaderCol>Item Version History</ItemList.HeaderCol>
          </ItemList.Header>

          <ItemList.Scroller>
            <ItemList.Items>
              {versions?.map((item, index) => {
                const versionKey = String(item.datasetVersion);
                const versionDate = typeof item.updatedAt === 'string' ? new Date(item.updatedAt) : item.updatedAt;

                return (
                  <ItemList.Row
                    key={String(item.datasetVersion)}
                    isSelected={isSelectionActive && selectedIds.has(versionKey)}
                  >
                    {isSelectionActive && (
                      <ItemList.LabelCell>
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
                      </ItemList.LabelCell>
                    )}
                    <ItemList.RowButton
                      item={item}
                      columns={[{ name: 'version', label: 'Item Version History', size: '1fr' }]}
                      isFeatured={isVersionSelected(item)}
                      onClick={() => handleVersionClick(item)}
                      className="py-2"
                    >
                      <ItemList.VersionCell
                        version={item.datasetVersion}
                        date={versionDate}
                        isLatest={item.isLatest}
                        isDeleted={item.isDeleted}
                      />
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
      <ItemList.Header columns={[{ name: 'version', label: 'Item Version History', size: '1fr' }]}>
        <ItemList.HeaderCol>Item Version History</ItemList.HeaderCol>
      </ItemList.Header>
      <ItemList.Items>
        {Array.from({ length: 3 }).map((_, index) => (
          <ItemList.Row key={index}>
            <ItemList.RowButton columns={[{ name: 'version', label: 'Item Version History', size: '1fr' }]}>
              <ItemList.TextCell isLoading>Loading...</ItemList.TextCell>
            </ItemList.RowButton>
          </ItemList.Row>
        ))}
      </ItemList.Items>
    </ItemList>
  );
}
