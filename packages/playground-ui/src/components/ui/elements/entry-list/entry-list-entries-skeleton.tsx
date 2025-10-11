import { type Column } from './types';
import { EntryListEntries } from './entry-list-entries';
import { EntryListEntry } from './entry-list-entry';

const widths = ['75%', '50%', '65%', '90%', '60%', '80%'];

export type EntryListEntriesSkeletonProps = {
  columns?: Column[];
  numberOfRows?: number;
};

export function EntryListEntriesSkeleton({ columns, numberOfRows = 3 }: EntryListEntriesSkeletonProps) {
  const getPseudoRandomWidth = (rowIdx: number, colIdx: number) => {
    const index = (rowIdx + colIdx + (columns?.length || 0) + (numberOfRows || 0)) % widths.length;
    return widths[index];
  };

  return (
    <EntryListEntries>
      {Array.from({ length: numberOfRows }).map((_, rowIdx) => (
        <EntryListEntry key={rowIdx} columns={columns}>
          {(columns || []).map((col, colIdx) => {
            const key = `${col.name}-${colIdx}`;
            return (
              <div
                key={key}
                className="bg-surface4 rounded-md animate-pulse text-transparent h-[1rem] select-none"
                style={{ width: `${getPseudoRandomWidth(rowIdx, colIdx)}` }}
              ></div>
            );
          })}
        </EntryListEntry>
      ))}
    </EntryListEntries>
  );
}
