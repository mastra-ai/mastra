import { ArrowLeftIcon, ArrowRightIcon, TriangleAlertIcon } from 'lucide-react';
import { EntryListTextCell } from './entry-list-cell';
import { EntryListItem } from './entry-list-item';
import { getColumnTemplate, type Column } from './shared';

import { cn } from '@/lib/utils';
import React, { isValidElement } from 'react';

export function EntryList({
  items: dataItems,
  selectedItemId,
  onItemClick,
  isLoading,
  isLoadingNextPage,
  total,
  page,
  hasMore,
  onNextPage,
  onPrevPage,
  perPage,
  columns,
  searchTerm,
  setEndOfListElement,
  errorMsg,
}: {
  items: Record<string, any>[];
  selectedItemId?: string;
  onItemClick?: (item: string) => void;
  isLoading?: boolean;
  isLoadingNextPage?: boolean;
  total?: number;
  page?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  perPage?: number;
  columns?: Column[];
  searchTerm?: string;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  errorMsg?: string;
}) {
  const loadingItems: Record<string, any>[] = Array.from({ length: 3 }).map((_, index) => {
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

  const items = isLoading ? loadingItems : dataItems;

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

      {errorMsg && !isLoading && (
        <div className="grid border border-border1 border-t-0 bg-surface3 rounded-xl rounded-t-none">
          <p
            className={cn(
              'text-[0.875rem] text-center items-center flex justify-center p-[2.5rem] gap-[1rem] text-icon3',
              '[&>svg]:w-[1.5em]',
              '[&>svg]:h-[1.5em]',
              '[&>svg]:text-red-500',
            )}
          >
            <TriangleAlertIcon /> {errorMsg || 'Something went wrong while fetching the data.'}
          </p>
        </div>
      )}

      {!isLoading && !errorMsg && items?.length === 0 && (
        <div className="grid border border-border1 border-t-0 bg-surface3 rounded-xl rounded-t-none">
          <p className="text-icon3 text-[0.875rem] text-center h-[3.5rem] items-center flex justify-center">
            {searchTerm ? `No results found for "${searchTerm}"` : 'No entries found'}
          </p>
        </div>
      )}

      {!errorMsg && items?.length > 0 && (
        <>
          <ul className="grid border border-border1 border-t-0 bg-surface3 rounded-xl rounded-t-none overflow-y-auto">
            {items.map(item => {
              return (
                <EntryListItem
                  key={item.id}
                  item={item}
                  selectedItemId={selectedItemId}
                  onClick={isLoading ? undefined : onItemClick}
                  columns={columns}
                  isLoading={isLoading}
                >
                  {(columns || []).map((col, index) => {
                    const isValidReactElement = isValidElement(item?.[col.name]);
                    const key = `${index}-${item.id}`;

                    return isValidReactElement ? (
                      <React.Fragment key={key}>{item?.[col.name]}</React.Fragment>
                    ) : (
                      <EntryListTextCell key={key} isLoading={isLoading}>
                        {item?.[col.name]}
                      </EntryListTextCell>
                    );
                  })}
                </EntryListItem>
              );
            })}
          </ul>

          {setEndOfListElement && (
            <div
              ref={setEndOfListElement}
              className="text-[0.875rem] text-icon3 opacity-50 flex mt-[2rem] justify-center"
            >
              {isLoadingNextPage && 'Loading...'}
              {!hasMore && !isLoadingNextPage && !isLoading && 'No more data to load'}
            </div>
          )}

          {typeof page === 'number' && typeof perPage === 'number' && typeof total === 'number' && (
            <div className={cn('flex pt-[1.5rem] items-center justify-center text-icon3 text-[0.875rem] gap-[2rem]')}>
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
