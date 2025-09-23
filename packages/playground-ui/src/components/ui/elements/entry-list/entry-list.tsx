import React from 'react';

type EntryListProps = {
  children: React.ReactNode;
};

export function EntryList({ children }: EntryListProps) {
  return <div className="grid mb-[3rem]">{children}</div>;
}
