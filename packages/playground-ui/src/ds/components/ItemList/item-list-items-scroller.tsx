import React from 'react';

export type ItemListItemsScroller = {
  children?: React.ReactNode;
};

export function ItemListItemsScroller({ children }: ItemListItemsScroller) {
  return <div className="overflow-y-auto">{children}</div>;
}
