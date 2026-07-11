import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';

export type DataListPaginationProps = {
  currentPage?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
};

export function DataListPagination({ currentPage, hasMore, onNextPage, onPrevPage }: DataListPaginationProps) {
  const showNavigation = (typeof currentPage === 'number' && currentPage > 0) || hasMore;

  return (
    <div className="col-span-full flex py-4 items-center justify-center text-neutral3 text-ui-md gap-8">
      <span>
        Page <b>{currentPage ? currentPage + 1 : '1'}</b>
      </span>
      {showNavigation && (
        <div className="flex gap-4">
          {typeof currentPage === 'number' && currentPage > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={onPrevPage}>
              <ArrowLeftIcon />
              Previous
            </Button>
          )}
          {hasMore && (
            <Button type="button" variant="outline" size="sm" onClick={onNextPage}>
              Next
              <ArrowRightIcon />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
