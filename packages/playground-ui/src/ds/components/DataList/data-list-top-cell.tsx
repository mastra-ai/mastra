import type { ComponentPropsWithoutRef, DragEvent, ElementType, KeyboardEvent, ReactNode } from 'react';
import { forwardRef, useState } from 'react';
import { useDataListReorder } from './data-list-reorder-context';
import { dataListStickyStartStyles } from './shared';
import type { DataListSticky } from './shared';
import { Checkbox } from '@/ds/components/Checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/ds/components/Tooltip';
import { focusRingInset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type DataListTopCellProps = {
  children: ReactNode;
  className?: string;
  /**
   * HTML element rendered for the top cell. Defaults to `span`. Use `'label'`
   * when the cell wraps a labelable control (e.g. a select-all Checkbox).
   */
  as?: ElementType;
  /** Pins the top cell to the horizontal start edge while the list scrolls sideways. */
  sticky?: DataListSticky;
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className' | 'ref'>;

export const DataListTopCell = forwardRef<HTMLSpanElement, DataListTopCellProps>(
  ({ children, className, as, sticky, ...rest }, ref) => {
    const Component = as || 'span';
    const isText = typeof children === 'string' || typeof children === 'number';
    const { reorderable, order, move } = useDataListReorder();
    const [isDropTarget, setIsDropTarget] = useState(false);
    const canReorder = reorderable && !sticky;

    const reorderProps = canReorder
      ? {
          draggable: true,
          tabIndex: 0,
          'aria-roledescription': 'draggable column',
          'data-drop-target': isDropTarget || undefined,
          onDragStart: (event: DragEvent<HTMLElement>) => {
            const from = getVisualPosition(event.currentTarget, order);
            if (from === null) return event.preventDefault();
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData(DRAG_TYPE, String(from));
          },
          onDragOver: (event: DragEvent<HTMLElement>) => {
            if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setIsDropTarget(true);
          },
          onDragLeave: () => setIsDropTarget(false),
          onDrop: (event: DragEvent<HTMLElement>) => {
            setIsDropTarget(false);
            const from = Number(event.dataTransfer.getData(DRAG_TYPE));
            const to = getVisualPosition(event.currentTarget, order);
            if (to === null || Number.isNaN(from)) return;
            event.preventDefault();
            move(from, to);
          },
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
            const from = getVisualPosition(event.currentTarget, order);
            if (from === null) return;
            const to = from + (event.key === 'ArrowLeft' ? -1 : 1);
            if (isStickyAt(event.currentTarget, order, to)) return;
            event.preventDefault();
            move(from, to);
          },
        }
      : undefined;

    return (
      <Component
        ref={ref}
        className={cn(
          'flex h-10 max-w-full min-w-0 items-center overflow-hidden py-1 text-column whitespace-nowrap text-muted-foreground',
          sticky === 'start' && dataListStickyStartStyles,
          sticky === 'start' && '-mx-3 w-auto max-w-none px-3',
          sticky === 'start' && 'z-20',
          canReorder &&
            'cursor-grab active:cursor-grabbing data-drop-target:shadow-[inset_2px_0_0_var(--border-focus)]',
          canReorder && focusRingInset,
          className,
        )}
        {...reorderProps}
        {...rest}
      >
        {/* Plain string/number titles truncate with an ellipsis; element children
            (icons, smart long/short labels, checkboxes) render as-is. */}
        {isText ? <span className="min-w-0 truncate">{children}</span> : children}
      </Component>
    );
  },
);

const DRAG_TYPE = 'application/x-mastra-data-list-column';

/** Visual position of a header cell, or `null` when it is not in a full-width cells container. */
function getVisualPosition(cell: HTMLElement, order: number[]): number | null {
  const parent = cell.parentElement;
  if (!parent?.classList.contains('data-list-cells')) return null;
  const visual = order.indexOf(Array.from(parent.children).indexOf(cell));
  return visual === -1 ? null : visual;
}

/** Whether the header cell at `visual` is pinned (so nothing may move into its slot). */
function isStickyAt(cell: HTMLElement, order: number[], visual: number): boolean {
  const original = order[visual];
  if (original === undefined) return true;
  return cell.parentElement?.children[original]?.classList.contains('data-list-sticky-start') ?? true;
}

export type DataListTopCellWithTooltipProps = {
  children: ReactNode;
  tooltip: ReactNode;
  className?: string;
};

export function DataListTopCellWithTooltip({ children, tooltip, className }: DataListTopCellWithTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <DataListTopCell className={className}>{children}</DataListTopCell>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export type DataListTopCellSmartProps = {
  long: ReactNode;
  short: ReactNode;
  tooltip?: string;
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
};

const breakpointClasses: Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', { show: string; hide: string }> = {
  sm: { show: 'hidden sm:inline-flex', hide: 'inline-flex sm:hidden' },
  md: { show: 'hidden md:inline-flex', hide: 'inline-flex md:hidden' },
  lg: { show: 'hidden lg:inline-flex', hide: 'inline-flex lg:hidden' },
  xl: { show: 'hidden xl:inline-flex', hide: 'inline-flex xl:hidden' },
  '2xl': { show: 'hidden 2xl:inline-flex', hide: 'inline-flex 2xl:hidden' },
};

export function DataListTopCellSmart({
  long,
  short,
  tooltip,
  breakpoint = '2xl',
  className,
}: DataListTopCellSmartProps) {
  const tooltipText = tooltip ?? (typeof long === 'string' ? long : undefined);
  const bp = breakpointClasses[breakpoint];

  const content = (
    <>
      <span className={cn('items-center gap-1', bp.show)}>{long}</span>
      <span className={cn('items-center gap-1', bp.hide)}>{short}</span>
    </>
  );

  if (tooltipText) {
    return (
      <DataListTopCellWithTooltip tooltip={tooltipText} className={cn('flex [&_svg]:size-[1.3em]', className)}>
        {content}
      </DataListTopCellWithTooltip>
    );
  }

  return <DataListTopCell className={cn('flex [&_svg]:size-[1.3em]', className)}>{content}</DataListTopCell>;
}

export interface DataListTopSelectCellProps {
  /** Pass `'indeterminate'` when some — but not all — rows are selected. */
  checked: boolean | 'indeterminate';
  /** Toggles the global selection. Typically clears when fully selected, otherwise selects all. */
  onToggle: () => void;
  'aria-label'?: string;
}

export function DataListTopSelectCell({ checked, onToggle, ...rest }: DataListTopSelectCellProps) {
  return (
    <DataListTopCell
      as="label"
      className="w-8 cursor-pointer justify-center overflow-visible px-0 py-0!"
      onClick={e => e.stopPropagation()}
    >
      <Checkbox checked={checked} onCheckedChange={() => onToggle()} aria-label={rest['aria-label']} />
    </DataListTopCell>
  );
}
