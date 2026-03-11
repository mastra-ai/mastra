import { GetScorerResponse } from '@mastra/client-js';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { ItemList } from '@/ds/components/ItemList';
import { ItemListSkeleton } from '@/ds/components/ItemList/item-list-skeleton';
import { type ItemListColumn } from '@/ds/components/ItemList/types';
import { useMemo, useState } from 'react';
import { useLinkComponent } from '@/lib/framework';
import { ListSearch } from '@/ds/components/ListSearch';
import { Column } from '@/ds/components/Columns';
import { NoScorersInfo } from './no-scorers-info';

const columns: ItemListColumn[] = [{ name: 'name', label: 'Name & Description', size: '1fr' }];

export interface ScorersListProps {
  scorers: Record<string, GetScorerResponse>;
  isLoading: boolean;
  error?: Error | null;
}

export function ScorersList({ scorers, isLoading, error }: ScorersListProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const scorersData = useMemo(
    () =>
      Object.entries(scorers).map(([key, scorer]) => ({
        ...scorer,
        id: key,
      })),
    [scorers],
  );

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return scorersData.filter(
      s =>
        s.scorer.config?.id?.toLowerCase().includes(term) ||
        s.scorer.config?.name?.toLowerCase().includes(term) ||
        s.scorer.config?.description?.toLowerCase().includes(term),
    );
  }, [scorersData, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="scorers" />;
  }

  if (scorersData.length === 0 && !isLoading) {
    return <NoScorersInfo />;
  }

  return (
    <Column>
      <Column.Toolbar>
        <ListSearch onSearch={setSearch} label="Filter scorers" placeholder="Filter by name or description" />
      </Column.Toolbar>

      <Column.Content>
        {isLoading ? (
          <ItemListSkeleton columns={columns} />
        ) : (
          <ItemList>
            <ItemList.Items>
              {filteredData.map(scorer => (
                <ItemList.Row key={scorer.id}>
                  <ItemList.RowButton
                    columns={columns}
                    item={{ id: scorer.id }}
                    onClick={() => navigate(paths.scorerLink(scorer.id))}
                    className="min-h-16"
                  >
                    <ItemList.TextCell className="grid">
                      <span className="text-neutral4 text-ui-md truncate">{scorer.scorer.config.name}</span>
                      {scorer.scorer.config.description && (
                        <span className="text-neutral2 text-ui-md truncate">{scorer.scorer.config.description}</span>
                      )}
                    </ItemList.TextCell>
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
