import { EntryList } from './entry-list';
import { EntryListEntriesSkeleton } from './entry-list-entries-skeleton';
import type { EntryListEntriesSkeletonProps } from './entry-list-entries-skeleton';
import { EntryListHeader } from './entry-list-header';
import { EntryListTrim } from './entry-list-trim';

export function EntryListSkeleton({ columns, numberOfRows }: EntryListEntriesSkeletonProps) {
  return (
    <EntryList>
      <EntryListTrim>
        <EntryListHeader columns={columns} />
        <EntryListEntriesSkeleton columns={columns} numberOfRows={numberOfRows} />
      </EntryListTrim>
    </EntryList>
  );
}
