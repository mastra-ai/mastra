import { type Column } from './types';
import { EntryListEntries } from './entry-list-entries';

type EntryListRowsSkeletonProps = {
  columns?: Column[];
};

export function EntryListEntriesSkeleton({ columns }: EntryListRowsSkeletonProps) {
  const items: Record<string, any>[] = Array.from({ length: 3 }).map((_, index) => {
    return {
      id: `loading-${index + 1}`,
      ...(columns || []).reduce(
        (acc, col) => {
          acc[col.name] = `...`;
          return acc;
        },
        {} as Record<string, any>,
      ),
    };
  });

  return <EntryListEntries entries={items} columns={columns} />;
}
