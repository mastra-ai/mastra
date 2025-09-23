import { EntryListTextCell } from './entry-list-cell';
import { EntryListEntry } from './entry-list-entry';
import { type Column } from './types';
import React, { isValidElement } from 'react';

type EntryListEntriesProps = {
  entries?: Record<string, any>[];
  selectedItemId?: string;
  onItemClick?: (item: string) => void;
  columns?: Column[];
  children?: React.ReactNode;
};

export function EntryListEntries({ entries, selectedItemId, columns, children }: EntryListEntriesProps) {
  return (
    <ul className="grid bg-surface3 overflow-y-auto">
      {entries
        ? entries.map(entry => {
            return (
              <EntryListEntry key={entry.id} item={entry} selectedItemId={selectedItemId} columns={columns}>
                {(columns || []).map((col, index) => {
                  const isValidReactElement = isValidElement(entry?.[col.name]);
                  const key = `${index}-${entry.id}`;

                  return isValidReactElement ? (
                    <React.Fragment key={key}>{entry?.[col.name]}</React.Fragment>
                  ) : (
                    <EntryListTextCell key={key}>{entry?.[col.name]}</EntryListTextCell>
                  );
                })}
              </EntryListEntry>
            );
          })
        : children}
    </ul>
  );
}
