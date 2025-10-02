import { EntryListEntriesSkeleton, type EntryListRowsSkeletonProps } from './entry-list-entries-skeleton';
import { EntryList } from './entry-list';
import { EntryListTrim } from './entry-list-trim';
import { EntryListHeader } from './entry-list-header';

type EntryListSkeletonProps = EntryListRowsSkeletonProps;

export function EntryListSkeleton({ columns, numberOfRows }: EntryListSkeletonProps) {
  return (
    <EntryList>
      <EntryListTrim>
        <EntryListHeader columns={columns} />
        <EntryListEntriesSkeleton columns={columns} numberOfRows={numberOfRows} />
      </EntryListTrim>
    </EntryList>
  );
}
