import React from 'react';

type EntryListEntriesProps = {
  children?: React.ReactNode;
};

export function EntryListEntries({ children }: EntryListEntriesProps) {
  return <ul className="grid bg-surface3 overflow-y-auto">{children}</ul>;
}
