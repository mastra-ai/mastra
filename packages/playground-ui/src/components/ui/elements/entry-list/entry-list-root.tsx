import React from 'react';

type EntryListRootProps = {
  children: React.ReactNode;
};

export function EntryListRoot({ children }: EntryListRootProps) {
  return <div className="grid mb-[3rem]">{children}</div>;
}
