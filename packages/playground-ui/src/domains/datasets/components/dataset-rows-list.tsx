import { EntryList, getShortId } from '@/components/ui/elements';
import { DatasetRow } from '@mastra/client-js';

import { format, isToday } from 'date-fns';

export const rowsListColumns = [
  { name: 'shortId', label: 'Id', size: '6rem' },
  { name: 'input', label: 'Input', size: '1fr' },
  { name: 'groundTruth', label: 'Ground Truth', size: '1fr' },
  { name: 'createdAt', label: 'Created At', size: '8rem' },
];

type DatasetRowsListProps = {
  rows?: DatasetRow[];
  selectedRowId?: string;
  onRowClick?: (id: string) => void;
  errorMsg?: string;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  filtersApplied?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
};

export function DatasetRowsList({
  rows,
  selectedRowId,
  onRowClick,
  errorMsg,
  setEndOfListElement,
  filtersApplied,
  isFetchingNextPage,
  hasNextPage,
}: DatasetRowsListProps) {
  if (!rows) {
    return null;
  }

  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={rowsListColumns} />
        {errorMsg ? (
          <EntryList.Message message={errorMsg} type="error" />
        ) : (
          <>
            {rows.length > 0 ? (
              <EntryList.Entries>
                {rows.map(row => {
                  const createdAtDate = new Date(row.createdAt);
                  const isTodayDate = isToday(createdAtDate);

                  const entry = {
                    id: row.rowId,
                    shortId: getShortId(row?.rowId) || 'n/a',
                    input: row?.input || 'n/a',
                    groundTruth: row?.groundTruth || 'n/a',
                    createdAt: isTodayDate
                      ? `Today ${format(createdAtDate, 'h:mm:ss aaa')}`
                      : format(createdAtDate, 'MMM dd h:mm:ss aaa'),
                  };

                  return (
                    <EntryList.Entry
                      key={entry.id}
                      entry={entry}
                      isSelected={selectedRowId === row.rowId}
                      columns={rowsListColumns}
                      onClick={onRowClick}
                    >
                      {rowsListColumns.map((col, index) => {
                        const key = `${index}-${row.rowId}`;
                        return (
                          <EntryList.EntryText key={key}>{entry?.[col.name as keyof typeof entry]}</EntryList.EntryText>
                        );
                      })}
                    </EntryList.Entry>
                  );
                })}
              </EntryList.Entries>
            ) : (
              <EntryList.Message
                message={filtersApplied ? 'No data items found for applied filters' : 'No data items found yet'}
              />
            )}
          </>
        )}
      </EntryList.Trim>
      <EntryList.NextPageLoading
        setEndOfListElement={setEndOfListElement}
        loadingText="Loading more traces..."
        noMoreDataText="All traces loaded"
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
      />
    </EntryList>
  );
}
