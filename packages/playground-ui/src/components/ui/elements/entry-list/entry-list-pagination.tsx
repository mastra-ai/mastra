import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type EntryListPaginationProps = {
  currentPage?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
};

export function EntryListPagination({ currentPage, hasMore, onNextPage, onPrevPage }: EntryListPaginationProps) {
  const showNavigation = (typeof currentPage === 'number' && currentPage > 0) || hasMore;

  return (
    <div className={cn('flex pt-[1.5rem] items-center justify-center text-icon3 text-[0.875rem] gap-[2rem] ')}>
      <span>
        Page <b>{currentPage ? currentPage + 1 : '1'}</b>
      </span>
      {showNavigation && (
        <div
          className={cn(
            'flex gap-[1rem]',
            '[&>button]:flex [&>button]:items-center [&>button]:gap-[0.5rem] [&>button]:text-icon4 [&>button:hover]:text-icon5 [&>button]:transition-colors [&>button]:border [&>button]:border-border1 [&>button]:p-[0.25rem] [&>button]:px-[0.5rem] [&>button]:rounded-md',
            '[&_svg]:w-[1em] [&_svg]:h-[1em] [&_svg]:text-icon3',
          )}
        >
          {typeof currentPage === 'number' && currentPage > 0 && (
            <button onClick={onPrevPage}>
              <ArrowLeftIcon />
              Previous
            </button>
          )}
          {hasMore && (
            <button onClick={onNextPage}>
              Next
              <ArrowRightIcon />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
