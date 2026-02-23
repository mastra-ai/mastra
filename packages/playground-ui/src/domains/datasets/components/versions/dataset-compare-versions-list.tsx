import { format } from 'date-fns';
import { SearchCodeIcon, BanIcon } from 'lucide-react';
import type { DatasetItem } from '@mastra/client-js';
import { ItemList } from '@/ds/components/ItemList';

export interface DatasetCompareVersionsListProps {
  allItems: Array<{ id: string; createdAt: Date }>;
  itemsAMap: Map<string, DatasetItem>;
  itemsBMap: Map<string, DatasetItem>;
  onItemClick?: (itemId: string, itemA?: DatasetItem, itemB?: DatasetItem) => void;
}

const columns = [
  { name: 'id', label: 'ID', size: '10rem' },
  { name: 'versionA', label: 'Version A', size: '13rem' },
  { name: 'versionB', label: 'Version B', size: '13rem' },
  { name: 'status', label: 'Status', size: '7rem' },
  { name: 'date', label: 'Created', size: '7rem' },
  { name: 'compare', label: 'Compare', size: '4rem' },
];

function formatVersion(item?: DatasetItem): string {
  if (!item) return '-';
  return `v${item.datasetVersion}`;
}

function getStatus(itemA?: DatasetItem, itemB?: DatasetItem): string {
  if (itemA && itemB && itemA.datasetVersion === itemB.datasetVersion) return 'same';
  if (itemA && itemB && itemA.datasetVersion !== itemB.datasetVersion) return 'changed';
  if (itemA) return 'added';
  return 'removed';
}

export function DatasetCompareVersionsList({
  allItems,
  itemsAMap,
  itemsBMap,
  onItemClick,
}: DatasetCompareVersionsListProps) {
  return (
    <ItemList>
      <ItemList.Header columns={columns}>
        {columns.map(col => (
          <ItemList.HeaderCol key={col.name}>{col.label || col.name}</ItemList.HeaderCol>
        ))}
      </ItemList.Header>

      <ItemList.Scroller>
        <ItemList.Items>
          {allItems.map(({ id, createdAt }) => {
            const itemA = itemsAMap.get(id);
            const itemB = itemsBMap.get(id);
            const status = getStatus(itemA, itemB);

            return (
              <ItemList.Row key={id}>
                <ItemList.RowButton
                  columns={columns}
                  entry={{ id }}
                  onClick={status === 'changed' ? () => onItemClick?.(id, itemA, itemB) : undefined}
                  disabled={status !== 'changed'}
                >
                  <ItemList.TextCell>{id}</ItemList.TextCell>
                  {status !== 'same' ? (
                    <>
                      <ItemList.TextCell className="justify-center flex">
                        v{itemA?.datasetVersion || ''}
                      </ItemList.TextCell>
                      <ItemList.TextCell className="justify-center flex">
                        v{itemB?.datasetVersion || ''}
                      </ItemList.TextCell>
                    </>
                  ) : (
                    <ItemList.TextCell className="col-span-2 justify-center flex">
                      v{itemB?.datasetVersion || ''}
                    </ItemList.TextCell>
                  )}
                  <ItemList.TextCell>{status}</ItemList.TextCell>
                  <ItemList.TextCell>{format(createdAt, 'MMM dd')}</ItemList.TextCell>
                  <ItemList.FlexCell className="justify-center">
                    {status === 'changed' ? (
                      <SearchCodeIcon className="w-5 h-5 opacity-50" />
                    ) : (
                      <BanIcon className="w-4 h-4 opacity-30" />
                    )}
                  </ItemList.FlexCell>
                </ItemList.RowButton>
              </ItemList.Row>
            );
          })}
        </ItemList.Items>
      </ItemList.Scroller>
    </ItemList>
  );
}
