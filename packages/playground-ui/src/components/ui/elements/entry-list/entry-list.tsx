import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { EntryListCell } from './entry-list-cell';
import { EntryListItem } from './entry-list-item';
import { getColumnTemplate, type Column } from './shared';

import { cn } from '@/lib/utils';

export function EntryList({
  items,
  selectedItem,
  onItemClick,
  isLoading,
  total,
  page,
  hasMore,
  onNextPage,
  onPrevPage,
  perPage,
  columns,
  searchTerm,
}: {
  items: any[];
  selectedItem: Record<string, any> | null;
  onItemClick?: (item: string) => void;
  isLoading?: boolean;
  total?: number;
  page?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  perPage?: number;
  columns?: Column[];
  searchTerm?: string;
}) {
  console.log('selectedItem', selectedItem);

  if (isLoading) {
    return (
      <div className="flex border border-border1 w-full h-[3.5rem] items-center justify-center text-[0.875rem] text-icon3 rounded-lg">
        Loading...
      </div>
    );
  }

  return (
    <div className="grid mb-[3rem]">
      <div className={cn('sticky top-0 bg-surface4 z-[1] rounded-t-lg border border-border1  px-[1.5rem]')}>
        <div
          className={cn('grid gap-[2rem] text-left uppercase py-[.75rem] text-icon3 text-[0.75rem]')}
          style={{ gridTemplateColumns: getColumnTemplate(columns) }}
        >
          {columns?.map(col => (
            <span key={col.name}>{col.label || col.name}</span>
          ))}
        </div>
      </div>

      {items?.length === 0 && (
        <div className="grid border border-border1 border-t-0 bg-surface3 rounded-xl rounded-t-none">
          <p className="text-icon3 text-[0.875rem] text-center h-[3.5rem] items-center flex justify-center">
            {searchTerm ? `No results found for "${searchTerm}"` : 'No entries found'}
          </p>
        </div>
      )}

      {items?.length > 0 && (
        <>
          <ul className="grid border border-border1 border-t-0 bg-surface3 rounded-xl rounded-t-none overflow-hidden">
            {items.map(item => {
              return (
                <EntryListItem
                  key={item.id}
                  item={item}
                  selectedItem={selectedItem}
                  onClick={onItemClick}
                  columns={columns}
                >
                  {(columns || []).map(col => (
                    <EntryListCell key={col.name}>{item?.[col.name]}</EntryListCell>
                  ))}
                </EntryListItem>
              );
            })}
          </ul>

          {typeof page === 'number' && typeof perPage === 'number' && typeof total === 'number' && (
            <div className={cn('flex items-center justify-center text-icon3 text-[0.875rem] gap-[2rem]')}>
              <span>Page {page ? page + 1 : '1'}</span>
              <div
                className={cn(
                  'flex gap-[1rem]',
                  '[&>button]:flex [&>button]:items-center [&>button]:gap-[0.5rem] [&>button]:text-icon4 [&>button:hover]:text-icon5 [&>button]:transition-colors [&>button]:border [&>button]:border-border1 [&>button]:p-[0.25rem] [&>button]:px-[0.5rem] [&>button]:rounded-md',
                  ' [&_svg]:w-[1em] [&_svg]:h-[1em] [&_svg]:text-icon3',
                )}
              >
                {typeof page === 'number' && page > 0 && (
                  <button onClick={onPrevPage} disabled={page === 0}>
                    <ArrowLeftIcon />
                    Previous
                  </button>
                )}
                {hasMore && (
                  <button onClick={onNextPage} disabled={!hasMore}>
                    Next
                    <ArrowRightIcon />
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
