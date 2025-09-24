import { EntryListEntryTextCol } from './entry-list-entry-col';
import { EntryListEntry } from './entry-list-entry';
import { type Column } from './types';
import React, { isValidElement } from 'react';

type EntryListEntriesProps = {
  entries?: Record<string, any>[];
  selectedEntryId?: string;
  onEntryClick?: (item: string) => void;
  columns?: Column[];
  children?: React.ReactNode;
};

export function EntryListEntries({ entries, selectedEntryId, columns, children, onEntryClick }: EntryListEntriesProps) {
  return (
    <ul className="grid bg-surface3 overflow-y-auto">
      {entries
        ? entries.map(entry => {
            return (
              <EntryListEntry
                key={entry.id}
                entry={entry}
                isSelected={selectedEntryId === entry.id}
                columns={columns}
                onClick={onEntryClick}
              >
                {(columns || []).map((col, index) => {
                  const isValidReactElement = isValidElement(entry?.[col.name]);
                  const key = `${index}-${entry.id}`;

                  return isValidReactElement ? (
                    <React.Fragment key={key}>{entry?.[col.name]}</React.Fragment>
                  ) : (
                    <EntryListEntryTextCol key={key}>{entry?.[col.name]}</EntryListEntryTextCol>
                  );
                })}
              </EntryListEntry>
            );
          })
        : children}
    </ul>
  );
}
