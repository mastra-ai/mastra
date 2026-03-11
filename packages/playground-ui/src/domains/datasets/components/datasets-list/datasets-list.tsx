import type { DatasetRecord } from '@mastra/client-js';
import { ItemList } from '@/ds/components/ItemList';
import { ItemListSkeleton } from '@/ds/components/ItemList/item-list-skeleton';
import { type ItemListColumn } from '@/ds/components/ItemList/types';
import { useMemo, useState } from 'react';
import { useLinkComponent } from '@/lib/framework';
import { ListSearch } from '@/ds/components/ListSearch';
import { Column } from '@/ds/components/Columns';
import { NoDatasetInfo } from './no-datasets-info';

const columns: ItemListColumn[] = [
  { name: 'name', label: 'Name & Description', size: '1fr' },
  { name: 'version', label: 'Version', size: '6rem' },
];

export interface DatasetsListProps {
  datasets: DatasetRecord[];
  isLoading: boolean;
  onCreateClick?: () => void;
}

export function DatasetsList({ datasets, isLoading, onCreateClick }: DatasetsListProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const sortedData = useMemo(() => {
    const sorted = [...datasets];
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [datasets]);

  const filteredData = useMemo(
    () => sortedData.filter(dataset => dataset.name.toLowerCase().includes(search.toLowerCase())),
    [sortedData, search],
  );

  if (datasets.length === 0 && !isLoading) {
    return <NoDatasetInfo onCreateClick={onCreateClick} />;
  }

  return (
    <Column>
      <Column.Toolbar>
        <ListSearch onSearch={setSearch} label="Filter datasets by name" placeholder="Filter by name" />
      </Column.Toolbar>

      <Column.Content>
        {isLoading ? (
          <ItemListSkeleton columns={columns} />
        ) : (
          <ItemList>
            <ItemList.Items>
              {filteredData.map(dataset => (
                <ItemList.Row key={dataset.id}>
                  <ItemList.RowButton
                    columns={columns}
                    item={{ id: dataset.id }}
                    onClick={() => navigate(paths.datasetLink(dataset.id))}
                  >
                    <ItemList.TextCell className="grid">
                      <span className="text-neutral4 text-ui-md truncate">{dataset.name}</span>
                      {dataset.description && (
                        <span className="text-neutral2 text-ui-md truncate">{dataset.description}</span>
                      )}
                    </ItemList.TextCell>
                    <ItemList.TextCell>v. {dataset.version}</ItemList.TextCell>
                  </ItemList.RowButton>
                </ItemList.Row>
              ))}
            </ItemList.Items>
          </ItemList>
        )}
      </Column.Content>
    </Column>
  );
}
