import React from 'react';

export type ItemListItemsProps = {
  children?: React.ReactNode;
};

export function ItemListItems({ children }: ItemListItemsProps) {
  return <ul className="grid overflow-y-auto">{children}</ul>;
}
