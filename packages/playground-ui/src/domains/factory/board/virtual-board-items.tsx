import type { ReactNode } from 'react';

import type { BoardLayout } from './board-layout';
import { VirtualBoardWindow } from './virtual-board-window';

const MAX_UNVIRTUALIZED_ITEMS = 30;

export function VirtualBoardItems<T>({
  items,
  itemKey,
  pinnedKey,
  layout,
  renderItem,
}: {
  items: readonly T[];
  itemKey: (item: T) => string;
  pinnedKey?: string;
  layout: BoardLayout;
  renderItem: (item: T) => ReactNode;
}) {
  if (items.length === 0) return null;

  const itemIndexes = new Map(items.map((item, index) => [itemKey(item), index]));

  return (
    <VirtualBoardWindow
      count={items.length}
      virtualized={items.length > MAX_UNVIRTUALIZED_ITEMS}
      layout={layout}
      pinnedKey={pinnedKey}
      getItemKey={index => itemKey(itemAt(items, index))}
      itemIndexes={itemIndexes}
      renderItem={index => renderItem(itemAt(items, index))}
    />
  );
}

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`No board item at ${index}`);
  return item;
}
