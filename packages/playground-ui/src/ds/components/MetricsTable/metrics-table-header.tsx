import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
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

type HeaderTextProps = {
  header: string;
  /** Underlines the label: the header has a tooltip. */
  explained: boolean;
};

/** The header's label, as a sort button with the sorted direction's arrow. Takes a tooltip's trigger props. */
function SortButton({
  header,
  explained,
  sorted,
  className,
  ...props
}: HeaderTextProps & { sorted?: MetricsTableSortDirection } & ComponentProps<'button'>) {
  const SortIcon = sorted && SORT_ICON[sorted];
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'group/header flex items-center gap-1 rounded whitespace-nowrap hover:text-muted-foreground',
        FOCUS,
        className,
      )}
    >
      <span className={cn(explained && EXPLAINED)}>{header}</span>
      {SortIcon && <SortIcon aria-hidden className="size-3" />}
    </button>
  );
}

/** The header's label as text; focusable when it has a tooltip, so the keyboard reaches it. */
function HeaderText({ header, explained, className, ...props }: HeaderTextProps & ComponentProps<'span'>) {
  return (
    <span
      tabIndex={explained ? 0 : undefined}
      {...props}
      className={cn('group/header rounded whitespace-nowrap', FOCUS, className)}
    >
      <span className={cn(explained && EXPLAINED)}>{header}</span>
    </span>
  );
}

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
  const explained = Boolean(description);
  const describedBy = explained ? descriptionId : undefined;
  const trigger = onSort ? (
    <SortButton header={header} explained={explained} sorted={sorted} onClick={onSort} aria-describedby={describedBy} />
  ) : (
    <HeaderText header={header} explained={explained} aria-describedby={describedBy} />
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
