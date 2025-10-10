import { EntryListEntriesSkeleton, type EntryListEntriesSkeletonProps } from './entry-list-entries-skeleton';
import { EntryList } from './entry-list';
import { EntryListTrim } from './entry-list-trim';
import { EntryListHeader } from './entry-list-header';

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
