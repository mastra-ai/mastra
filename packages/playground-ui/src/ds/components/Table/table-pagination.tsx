import type { ComponentProps } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../Pagination/pagination';
import { getPaginationRange } from '../Pagination/pagination-range';

export type TablePaginationProps = Omit<ComponentProps<'nav'>, 'children'> & {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function TablePagination({ page, pageCount, onPageChange, ...props }: TablePaginationProps) {
  return (
    <Pagination {...props}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious disabled={page <= 0} onClick={() => onPageChange(page - 1)} />
        </PaginationItem>
        {getPaginationRange(page, pageCount).map(item => {
          if (item.kind === 'ellipsis') {
            return (
              <PaginationItem key={item.key}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }
          return (
            <PaginationItem key={item.page}>
              <PaginationLink
                aria-label={`Page ${item.page + 1}`}
                isActive={item.page === page}
                onClick={() => onPageChange(item.page)}
              >
                {item.page + 1}
              </PaginationLink>
            </PaginationItem>
          );
        })}
        <PaginationItem>
          <PaginationNext disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
