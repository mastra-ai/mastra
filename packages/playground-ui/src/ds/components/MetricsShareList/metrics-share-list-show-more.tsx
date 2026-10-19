import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

/** The list's last row: pages more rows in, or collapses back to the top rows. */
export function ShowMore({
  shown,
  total,
  limit,
  pageSize,
  onMore,
  onLess,
}: {
  shown: number;
  total: number;
  limit: number;
  pageSize: number;
  onMore: () => void;
  onLess: () => void;
}) {
  if (total <= limit) return null;
  const left = total - shown;
  const button =
    'flex items-center gap-1.5 rounded-md px-2 py-1 text-body-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-fill-subtle hover:text-foreground';
  const n = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  return (
    <li className="-mx-2 flex items-center gap-1">
      {left > 0 && (
        <button type="button" onClick={onMore} className={button}>
          <ChevronDownIcon className="size-3.5 shrink-0" />
          Show {Math.min(left, pageSize)} more
        </button>
      )}
      {shown > limit && (
        <button type="button" onClick={onLess} className={button}>
          <ChevronUpIcon className="size-3.5 shrink-0" />
          Show top {limit}
        </button>
      )}
      {left > 0 && (
        <span className="ml-auto pr-2 text-body-sm text-placeholder tabular-nums">
          {n.format(shown)} of {n.format(total)}
        </span>
      )}
    </li>
  );
}
