import React from 'react';

export type ItemListRootProps = {
  children: React.ReactNode;
};

export function ItemListRoot({ children }: ItemListRootProps) {
  return <div className="grid grid-rows-[auto_1fr] overflow-y-auto">{children}</div>;
}
