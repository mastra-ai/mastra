import { Button } from '@/ds/components/Button';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { IconArrowRight } from '@/ds/icons/central/IconArrowRight';

export type DataListPaginationProps = {
  currentPage?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
};

export function DataListPagination({ currentPage, hasMore, onNextPage, onPrevPage }: DataListPaginationProps) {
  const showNavigation = (typeof currentPage === 'number' && currentPage > 0) || hasMore;

  return (
    <div className="col-span-full flex items-center justify-center gap-4 py-3 text-body text-muted-foreground">
      <span>
        Page <b>{currentPage ? currentPage + 1 : '1'}</b>
      </span>
      {showNavigation && (
        <div className="flex gap-4">
          {typeof currentPage === 'number' && currentPage > 0 && (
            <Button type="button" size="sm" onClick={onPrevPage} icon={<IconArrowLeft />}>
              Previous
            </Button>
          )}
          {hasMore && (
            <Button type="button" size="sm" onClick={onNextPage} icon={<IconArrowRight />}>
              Next
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
