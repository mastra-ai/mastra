import type { ReactNode } from 'react';

import type { BoardLayout } from '../boardLayout';
import { VirtualBoardWindow } from './VirtualBoardWindow';

export function VirtualBoardItems<T>({
  items,
  itemKey,
  pinned,
  layout,
  renderItem,
}: {
  items: readonly T[];
  itemKey: (item: T) => string;
  pinned?: (item: T) => boolean;
  layout: BoardLayout;
  renderItem: (item: T) => ReactNode;
}) {
  // Small groups need no measurement or scroll subscriptions. Keeping them in
  // normal flow also preserves collapsed groups' drafts and details state.
  if (items.length <= 30) return items.map(renderItem);

  const itemIndexes = new Map(items.map((item, index) => [itemKey(item), index]));

  return (
    <VirtualBoardWindow
      key={layout}
      count={items.length}
      layout={layout}
      pinnedIndex={pinned ? items.findIndex(pinned) : -1}
      getItemKey={index => itemKey(items[index]!)}
      getItemIndex={key => itemIndexes.get(key)}
      renderItem={index => renderItem(items[index]!)}
    />
  );
}
