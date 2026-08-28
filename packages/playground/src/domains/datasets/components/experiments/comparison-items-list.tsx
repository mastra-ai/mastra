import { useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { ItemList } from '@mastra/playground-ui/components/ItemList';
import type { ComparisonRow } from './build-comparison-rows';
import { ScoreDelta } from './score-delta';

export interface ComparisonItemsListProps {
  rows: ComparisonRow[];
  featuredItemId: string | null;
  onItemClick: (itemId: string) => void;
}

const columns = [{ name: 'itemId', label: 'Item ID', size: '1fr' }];

/** Narrow navigation column: pick the item whose two sides are displayed. */
export function ComparisonItemsList({ rows, featuredItemId, onItemClick }: ComparisonItemsListProps) {
  const { containerRef, getRowProps } = useDataListKeyboard({ count: rows.length });

  return (
    <section aria-label="Items" className="min-w-0" ref={containerRef}>
      <ItemList>
        <ItemList.Header columns={columns}>
          <ItemList.HeaderCol>Items</ItemList.HeaderCol>
        </ItemList.Header>

        <ItemList.Scroller>
          <ItemList.Items>
            {rows.map((row, index) => {
              const deltas = Object.entries(row.deltas).filter(([, delta]) => delta != null && delta !== 0);

              return (
                <ItemList.Row key={row.itemId}>
                  <ItemList.RowButton
                    item={{ id: row.itemId }}
                    columns={columns}
                    isFeatured={featuredItemId === row.itemId}
                    onClick={onItemClick}
                    {...getRowProps(index)}
                  >
                    <ItemList.Cell className="grid gap-1">
                      <span className={row.baseline.present && row.contender.present ? '' : 'text-neutral1'}>
                        {row.itemId}
                      </span>
                      {deltas.length > 0 && (
                        <span className="flex flex-wrap items-center gap-2">
                          {deltas.map(([scorerId, delta]) => (
                            <ScoreDelta key={scorerId} delta={delta as number} />
                          ))}
                        </span>
                      )}
                    </ItemList.Cell>
                  </ItemList.RowButton>
                </ItemList.Row>
              );
            })}
          </ItemList.Items>
        </ItemList.Scroller>
      </ItemList>
    </section>
  );
}
