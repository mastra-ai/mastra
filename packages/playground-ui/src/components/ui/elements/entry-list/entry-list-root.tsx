import React from 'react';

type EntryListRootProps = {
  children: React.ReactNode;
};

export function EntryListRoot({ children }: EntryListRootProps) {
  return <div className="grid">{children}</div>;
}
