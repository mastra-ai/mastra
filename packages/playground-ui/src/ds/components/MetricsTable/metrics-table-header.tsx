import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { MetricsTableSortDirection } from './metrics-table-types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

const SORT_ICON = { asc: ArrowUpIcon, desc: ArrowDownIcon };

export const FOCUS =
  'focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-border-focus focus-visible:-outline-offset-1';

/**
 * A faint dotted underline under the label: the header explains itself on hover or focus. It
 * brightens while the header is hovered or focused, so it hints without pulling the eye at rest.
 */
const EXPLAINED =
  'cursor-help underline decoration-dotted decoration-placeholder/45 underline-offset-4 transition-[text-decoration-color] duration-150 group-hover/header:decoration-placeholder group-focus-visible/header:decoration-placeholder';

/**
 * A column's header: a sort button when the column sorts, plain text otherwise. With a
 * `description`, the label itself shows it in a tooltip (no separate info icon), marked by a
 * dotted underline, and screen readers get it as the header's description.
 */
export function MetricsTableHeaderLabel({
  header,
  description,
  sorted,
  onSort,
}: {
  header: string;
  description?: ReactNode;
  sorted?: MetricsTableSortDirection;
  /** Makes the header a sort button. */
  onSort?: () => void;
}) {
  const descriptionId = useId();
  const SortIcon = sorted && SORT_ICON[sorted];
  const explained = Boolean(description);
  const label = <span className={cn(explained && EXPLAINED)}>{header}</span>;
  const described = explained ? { 'aria-describedby': descriptionId } : {};

  const trigger = onSort ? (
    <button
      type="button"
      onClick={onSort}
      {...described}
      className={cn(
        'group/header flex items-center gap-1 rounded whitespace-nowrap hover:text-muted-foreground',
        FOCUS,
      )}
    >
      {label}
      {SortIcon && <SortIcon aria-hidden className="size-3" />}
    </button>
  ) : (
    // Focusable only to reach its tooltip from the keyboard.
    <span
      tabIndex={explained ? 0 : undefined}
      {...described}
      className={cn('group/header rounded whitespace-nowrap', FOCUS)}
    >
      {label}
    </span>
  );

  if (!explained) return trigger;
  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      {/* Kept mounted (hidden) while closed, so screen readers always get the text. */}
      <TooltipContent id={descriptionId} keepMounted side="top" className="max-w-72">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
