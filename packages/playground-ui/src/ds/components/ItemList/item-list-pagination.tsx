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
    <div className={cn('flex items-center justify-center gap-4 pt-4 text-body text-muted-foreground')}>
      <span>
        Page <b>{currentPage ? currentPage + 1 : '1'}</b>
      </span>
      {showNavigation && (
        <div
          className={cn(
            'flex gap-4',
            '[&>button]:flex [&>button]:items-center [&>button]:gap-2 [&>button]:rounded-md [&>button]:border [&>button]:border-border [&>button]:p-1 [&>button]:px-2 [&>button]:text-muted-foreground [&>button]:transition-colors [&>button:hover]:text-foreground',
            '[&_svg]:size-[1em] [&_svg]:text-muted-foreground',
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
