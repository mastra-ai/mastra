import React from 'react';

export type ItemListRootProps = {
  children: React.ReactNode;
};

export function ItemListRoot({ children }: ItemListRootProps) {
  return <div className="grid">{children}</div>;
}
