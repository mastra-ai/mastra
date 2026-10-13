import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';
import { useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { FluidHoverHighlight } from '@/components/fluid-hover-highlight';
import { Icon } from '@/ds/icons/Icon';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import { raisedControlSurfaceStyle } from '@/ds/primitives/form-element';
import { controlStateColorTransition, focusRing } from '@/ds/primitives/transitions';
import { useFluidHover, useRegisterFluidHoverItem } from '@/hooks/use-fluid-hover';
import type { UseFluidHoverReturn } from '@/hooks/use-fluid-hover';
import { cn } from '@/lib/utils';

export type TablePaginationProps = Omit<ComponentProps<'nav'>, 'children'> & {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

type PageItem = { kind: 'page'; page: number } | { kind: 'gap'; key: 'start-gap' | 'end-gap' };

type PageNumberItem = Extract<PageItem, { kind: 'page' }>;

const pageItem = (page: number): PageNumberItem => ({ kind: 'page', page });

const isPageItem = (item: PageItem): item is PageNumberItem => item.kind === 'page';

function windowStart(page: number, pageCount: number) {
  const start = Math.max(1, Math.min(page - 1, pageCount - 5));
  if (start === 2) return 1;
  return start;
}

function windowEnd(page: number, pageCount: number) {
  const end = Math.min(pageCount - 2, Math.max(page + 1, 4));
  if (end === pageCount - 3) return pageCount - 2;
  return end;
}

function getPageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => pageItem(index));
  const first = windowStart(page, pageCount);
  const last = windowEnd(page, pageCount);
  const middle = Array.from({ length: last - first + 1 }, (_, index) => pageItem(first + index));
  const items: PageItem[] = [pageItem(0)];
  if (first > 1) items.push({ kind: 'gap', key: 'start-gap' });
  items.push(...middle);
  if (last < pageCount - 2) items.push({ kind: 'gap', key: 'end-gap' });
  items.push(pageItem(pageCount - 1));
  return items;
}

function indicatorIndex(pageSlots: number[], page: number) {
  const slot = pageSlots.indexOf(page);
  if (slot < 0) return null;
  return slot + 1;
}

const isInert = (element: HTMLElement) => element.getAttribute('aria-disabled') === 'true';

const pageButtonClass = cn(
  controlSizeClasses.sm,
  controlStateColorTransition,
  focusRing,
  'relative inline-flex min-w-control-sm cursor-pointer items-center justify-center gap-1 rounded-full px-2.5 text-muted-foreground tabular-nums',
  'hover:text-foreground aria-[current=page]:text-foreground',
  'aria-disabled:cursor-not-allowed aria-disabled:text-placeholder aria-disabled:hover:text-placeholder',
);

type PageButtonProps = {
  index: number;
  registerItem: UseFluidHoverReturn['registerItem'];
  label?: string;
  current?: boolean;
  inert?: boolean;
  onSelect: () => void;
  children: ReactNode;
};

function PageButton({ index, registerItem, label, current, inert, onSelect, children }: PageButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useRegisterFluidHoverItem(registerItem, index, ref);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-current={current && 'page'}
      aria-disabled={inert || undefined}
      className={pageButtonClass}
      onClick={() => {
        if (!inert) onSelect();
      }}
    >
      {children}
    </button>
  );
}

export function TablePagination({
  page,
  pageCount,
  onPageChange,
  className,
  'aria-label': ariaLabel = 'Pagination',
  ...props
}: TablePaginationProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(listRef, { axis: 'x', isItemDisabled: isInert, gapClick: false });
  const items = getPageItems(page, pageCount);
  const pageSlots = items.filter(isPageItem).map(item => item.page);
  const currentIndicator = { ...hover, activeIndex: indicatorIndex(pageSlots, page) };
  const isFirstPage = page <= 0;
  const isLastPage = page >= pageCount - 1;
  const nextIndex = pageSlots.length + 1;

  return (
    <nav
      data-slot="table-pagination"
      aria-label={ariaLabel}
      className={cn('flex items-center justify-center', className)}
      {...props}
    >
      <div ref={listRef} {...hover.handlers} className="relative isolate">
        <FluidHoverHighlight hover={hover} className="-z-2 rounded-full bg-fill-subtle" />
        <FluidHoverHighlight hover={currentIndicator} className={cn('-z-1 rounded-full', raisedControlSurfaceStyle)} />
        <ul className="flex items-center gap-1">
          <li>
            <PageButton
              index={0}
              registerItem={hover.registerItem}
              inert={isFirstPage}
              onSelect={() => onPageChange(page - 1)}
            >
              <Icon size="sm">
                <ChevronLeft />
              </Icon>
              Previous
            </PageButton>
          </li>
          {items.map(item => {
            if (item.kind === 'gap') {
              return (
                <li key={item.key} className="flex w-control-sm justify-center text-muted-foreground">
                  <Icon size="sm" aria-hidden>
                    <Ellipsis />
                  </Icon>
                  <span className="sr-only">More pages</span>
                </li>
              );
            }
            const slot = pageSlots.indexOf(item.page) + 1;
            return (
              <li key={item.page}>
                <PageButton
                  index={slot}
                  registerItem={hover.registerItem}
                  label={`Page ${item.page + 1}`}
                  current={item.page === page}
                  onSelect={() => onPageChange(item.page)}
                >
                  {item.page + 1}
                </PageButton>
              </li>
            );
          })}
          <li>
            <PageButton
              index={nextIndex}
              registerItem={hover.registerItem}
              inert={isLastPage}
              onSelect={() => onPageChange(page + 1)}
            >
              Next
              <Icon size="sm">
                <ChevronRight />
              </Icon>
            </PageButton>
          </li>
        </ul>
      </div>
    </nav>
  );
}
