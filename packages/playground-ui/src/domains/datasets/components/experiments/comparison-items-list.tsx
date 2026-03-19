import { ItemList } from '@/ds/components/ItemList';
import { Column } from '@/ds/components/Columns';
import { ScoreDelta } from './score-delta';
import type { CompareExperimentsResponse } from '@mastra/client-js';
import type { ItemListColumn } from '@/ds/components/ItemList/types';
import { Ban, BanIcon } from 'lucide-react';

type ComparisonItem = CompareExperimentsResponse['items'][number];

export interface ComparisonItemsListProps {
  items: ComparisonItem[];
  baselineId: string;
  contenderId: string;
  scorerIds: string[];
  featuredItemId: string | null;
  columns: ItemListColumn[];
  onItemClick: (itemId: string) => void;
}

export function ComparisonItemsList({
  items,
  baselineId,
  contenderId,
  scorerIds,
  featuredItemId,
  columns,
  onItemClick,
}: ComparisonItemsListProps) {
  return (
    <Column>
      <ItemList>
        <ItemList.Header columns={columns}>
          <ItemList.HeaderCol>Item ID</ItemList.HeaderCol>
          {!featuredItemId &&
            scorerIds.map(id => (
              <ItemList.HeaderCol className="flex justify-center" key={id}>
                {id}
              </ItemList.HeaderCol>
            ))}
        </ItemList.Header>

        <ItemList.Scroller>
          <ItemList.Items>
            {items.map(item => {
              const baselineResult = item.results[baselineId];
              const contenderResult = item.results[contenderId];
              const inBoth = Boolean(baselineResult && contenderResult);

              return (
                <ItemList.Row key={item.itemId}>
                  <ItemList.RowButton
                    item={{ id: item.itemId }}
                    columns={columns}
                    isFeatured={featuredItemId === item.itemId}
                    onClick={onItemClick}
                  >
                    <ItemList.IdCell id={item.itemId} className={inBoth ? '' : 'text-neutral1'} />
                    {!featuredItemId && (
                      <>
                        {scorerIds.map(scorerId => {
                          const baselineScore = baselineResult?.scores[scorerId] ?? null;
                          const contenderScore = contenderResult?.scores[scorerId] ?? null;
                          const delta =
                            baselineScore != null && contenderScore != null ? contenderScore - baselineScore : null;

                          return (
                            <ItemList.Cell key={scorerId} className="flex items-center gap-5 justify-center font-mono">
                              {delta != null ? (
                                <>
                                  <span className="flex items-center text-neutral2 min-w-24">
                                    {baselineScore?.toFixed(2)} → {contenderScore?.toFixed(2)}
                                  </span>
                                  <ScoreDelta delta={delta} />
                                </>
                              ) : (
                                <span className="text-neutral1">-</span>
                              )}
                            </ItemList.Cell>
                          );
                        })}
                      </>
                    )}
                  </ItemList.RowButton>
                </ItemList.Row>
              );
            })}
          </ItemList.Items>
        </ItemList.Scroller>
      </ItemList>
    </Column>
  );
}
