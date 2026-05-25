import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type EntityListPaginationProps = {
  currentPage?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
};

export function EntityListPagination({ currentPage, hasMore, onNextPage, onPrevPage }: EntityListPaginationProps) {
  const showNavigation = (typeof currentPage === 'number' && currentPage > 0) || hasMore;

  return (
    <div className={cn('col-span-full flex items-center justify-center gap-8 pt-6 pb-4 text-ui-md text-neutral3')}>
      <span>
        Page <b>{currentPage ? currentPage + 1 : '1'}</b>
      </span>
      {showNavigation && (
        <div
          className={cn(
            'flex gap-4',
            '[&>button]:flex [&>button]:items-center [&>button]:gap-2 [&>button]:text-neutral4 [&>button:hover]:text-neutral5 [&>button]:transition-colors [&>button]:border [&>button]:border-border1 [&>button]:p-1 [&>button]:px-2 [&>button]:rounded-md',
            '[&_svg]:w-[1em] [&_svg]:h-[1em] [&_svg]:text-neutral3',
          )}
        >
          {typeof currentPage === 'number' && currentPage > 0 && (
            <button type="button" onClick={onPrevPage}>
              <ArrowLeftIcon />
              Previous
            </button>
          )}
          {hasMore && (
            <button type="button" onClick={onNextPage}>
              Next
              <ArrowRightIcon />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
