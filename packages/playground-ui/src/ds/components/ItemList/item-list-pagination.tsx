import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ItemListPaginationProps = {
  currentPage?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
};

export function ItemListPagination({ currentPage, hasMore, onNextPage, onPrevPage }: ItemListPaginationProps) {
  const showNavigation = (typeof currentPage === 'number' && currentPage > 0) || hasMore;

  return (
    <div className={cn('flex items-center justify-center gap-8 pt-6 text-ui-md text-neutral3')}>
      <span>
        Page <b>{currentPage ? currentPage + 1 : '1'}</b>
      </span>
      {showNavigation && (
        <div
          className={cn(
            'flex gap-4',
            '[&>button]:flex [&>button]:items-center [&>button]:gap-2 [&>button]:rounded-md [&>button]:border [&>button]:border-border1 [&>button]:p-1 [&>button]:px-2 [&>button]:text-neutral4 [&>button]:transition-colors [&>button:hover]:text-neutral5',
            '[&_svg]:size-[1em] [&_svg]:text-neutral3',
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
