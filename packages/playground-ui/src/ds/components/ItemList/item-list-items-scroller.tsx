import React from 'react';
import { ScrollArea } from '@/ds/components/ScrollArea';

export type ItemListItemsScroller = {
  children?: React.ReactNode;
};

export function ItemListItemsScroller({ children }: ItemListItemsScroller) {
  return <ScrollArea permanentScrollbar>{children}</ScrollArea>;
}
