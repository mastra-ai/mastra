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

const pageItem = (page: number): PageItem => ({ kind: 'page', page });

function getPageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => pageItem(index));
  const windowStart = Math.max(1, Math.min(page - 1, pageCount - 5));
  const windowEnd = Math.min(pageCount - 2, Math.max(page + 1, 4));
  const first = windowStart === 2 ? 1 : windowStart;
  const last = windowEnd === pageCount - 3 ? pageCount - 2 : windowEnd;
  const middle = Array.from({ length: last - first + 1 }, (_, index) => pageItem(first + index));
  const startGap: PageItem[] = first > 1 ? [{ kind: 'gap', key: 'start-gap' }] : [];
  const endGap: PageItem[] = last < pageCount - 2 ? [{ kind: 'gap', key: 'end-gap' }] : [];
  return [pageItem(0), ...startGap, ...middle, ...endGap, pageItem(pageCount - 1)];
}

const isInert = (element: HTMLElement) => element.getAttribute('aria-disabled') === 'true';

const pageButtonClass = cn(
  controlSizeClasses.sm,
  controlStateColorTransition,
  focusRing,
  'relative inline-flex min-w-control-sm cursor-pointer items-center justify-center gap-1 rounded-full px-2.5 text-muted-foreground tabular-nums',
  'hover:text-foreground aria-current:text-foreground',
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
      aria-current={current ? 'page' : undefined}
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
  const listRef = useRef<HTMLUListElement>(null);
  const hover = useFluidHover(listRef, { axis: 'x', isItemDisabled: isInert, gapClick: false });
  const items = getPageItems(page, pageCount);
  const pageSlots = items.flatMap(item => (item.kind === 'page' ? [item.page] : []));
  const currentSlot = pageSlots.indexOf(page) + 1;
  const currentRect = hover.isMeasured && currentSlot > 0 ? hover.itemRects[currentSlot] : undefined;
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
      <ul ref={listRef} {...hover.handlers} className="relative isolate flex items-center gap-1">
        <FluidHoverHighlight hover={hover} className="-z-2 rounded-full bg-fill-subtle" />
        {currentRect ? (
          <span
            aria-hidden
            data-slot="table-pagination-indicator"
            className={cn(
              'pointer-events-none absolute top-0 left-0 -z-1 rounded-full',
              raisedControlSurfaceStyle,
              'transition-[translate,width] duration-200 ease-in-out motion-reduce:transition-none',
            )}
            style={{
              translate: `${currentRect.left}px ${currentRect.top}px`,
              width: currentRect.width,
              height: currentRect.height,
            }}
          />
        ) : null}
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
              <li key={item.key} aria-hidden className="flex w-control-sm justify-center text-muted-foreground">
                <Icon size="sm">
                  <Ellipsis />
                </Icon>
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
    </nav>
  );
}
