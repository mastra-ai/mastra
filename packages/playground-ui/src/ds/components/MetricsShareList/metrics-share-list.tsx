import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type MetricsShareListRow = {
  /** Stable id, also used to link a row to its strip segment. */
  key: string;
  /** Row label: plain text, or richer content (e.g. a method and a path). */
  label: ReactNode;
  /** Full text of a label that may truncate, shown on hover. Defaults to `label` when it's a string. */
  title?: string;
  /** The measure the strip divides (requests, cost, time spent). Rows rank by it, largest first. */
  share: number;
  /** The main, right-most column, usually `share` formatted. */
  value: ReactNode;
  /** Extra columns before Share, in `columns` order. */
  cells?: ReactNode[];
  /** Drill-down for the whole row. */
  href?: string;
  /** Row action (e.g. filter the page to this row); the row renders as a button. */
  onClick?: () => void;
};

export type MetricsShareListColumn = {
  label: string;
  /** Tailwind width class, shared by the header and the cells. Default `w-16`. */
  width?: string;
};

export type MetricsShareListHeaderProps = {
  /** Extra columns before Share, in the rows' `cells` order. */
  columns?: MetricsShareListColumn[];
  /** Header of the main column. */
  valueLabel: string;
  /** Tailwind width class of the main column. Default `w-14`. */
  valueWidth?: string;
  className?: string;
};

export type MetricsShareListProps = MetricsShareListHeaderProps & {
  rows: MetricsShareListRow[];
  /**
   * Row colors, from `color` (the first row) on.
   * - `shades`: one hue fading down the ranking. Reads well up to about six rows.
   * - `hues`: five cool hues, lighter each round. For long lists.
   */
  palette?: 'shades' | 'hues';
  /** Color of the first row. Default: brand green. */
  color?: string;
  /** Rows shown before the rest folds or pages. Default 5. */
  limit?: number;
  /**
   * What happens to rows past `limit`.
   * - `other`: one gray "Other (N)" row sums them (a summary card).
   * - `more`: a "Show more" row pages them in (a list to scan, e.g. every route).
   */
  overflow?: 'other' | 'more';
  /** Rows each "Show more" adds. Default 50. */
  pageSize?: number;
  /** Main value and extra cells of the "Other" row, from the rows folded into it. */
  other?: (rest: MetricsShareListRow[]) => Pick<MetricsShareListRow, 'value' | 'cells'>;
  /** Key of the row the page is filtered to: highlighted, and kept listed when it ranks past the shown rows. */
  activeKey?: string;
  /** Header row above the strip. Off when the card shows `MetricsShareList.Header` elsewhere (e.g. beside tabs). */
  showHeader?: boolean;
  /** Shown when there are no rows. */
  emptyState?: ReactNode;
  /** Skeleton rows in the list's own markup, so the card keeps its height when data lands. */
  isLoading?: boolean;
  /** Router-aware link for `href` rows; plain `<a>` when omitted. */
  LinkComponent?: ElementType;
  className?: string;
};

/** Brand green, toned down for large fills. */
const DEFAULT_COLOR = 'oklch(82% .16 145)';
/**
 * Cool hues for long lists: green, sky, violet, teal, indigo, ordered so neighbours sit far
 * apart on the wheel; no warning amber or error red. The first row's color leads.
 */
const HUES = [DEFAULT_COLOR, 'oklch(78% .11 228)', 'oklch(72% .11 295)', 'oklch(80% .1 185)', 'oklch(66% .12 265)'];
const SHADES = [100, 70, 48, 32, 20, 14];
const REST_COLOR = 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)';
/** Rows with their own strip segment; past that, segments get too thin and share the gray one. */
const SEGMENTS = 50;
const REST = '__rest';

const fade = (color: string, pct: number) =>
  pct >= 100 ? color : `color-mix(in oklab, ${color} ${pct}%, transparent)`;

function rowColors(base: string, count: number, palette: 'shades' | 'hues') {
  if (palette === 'hues') {
    const hues = [base, ...HUES.filter(h => h !== base)].slice(0, 5);
    return Array.from({ length: count }, (_, i) =>
      fade(hues[i % hues.length] ?? base, [100, 55, 30][Math.floor(i / hues.length)] ?? 20),
    );
  }
  return Array.from({ length: count }, (_, i) => fade(base, SHADES[i] ?? 10));
}

const fmtShare = (n: number, total: number) => {
  const r = n / (total || 1);
  if (n > 0 && r < 0.001) return '<0.1%';
  return `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`;
};

const ROW = '-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-1 text-left';
const NUM = 'shrink-0 text-right text-body-sm tabular-nums';

/** Column headers, right-aligned to the list's number columns. */
export function MetricsShareListHeader({
  columns = [],
  valueLabel,
  valueWidth = 'w-14',
  className,
}: MetricsShareListHeaderProps) {
  return (
    <div aria-hidden className={cn('flex shrink-0 items-center gap-3 text-column text-placeholder', className)}>
      {columns.map(c => (
        <span key={c.label} className={cn('shrink-0 text-right', c.width ?? 'w-16')}>
          {c.label}
        </span>
      ))}
      <span className="w-12 shrink-0 text-right">Share</span>
      <span className={cn('shrink-0 text-right', valueWidth)}>{valueLabel}</span>
    </div>
  );
}

type Shown = MetricsShareListRow & { color: string; segment: string };

/**
 * Each row's share of a total: one 100% strip on top, the ranked rows below with their share
 * and values. Hovering a segment or a row highlights the pair; every segment has its row, so
 * there is no tooltip. A non-zero share always gets a visible segment; a zero gets none.
 */
export function MetricsShareList({
  rows: input,
  columns = [],
  valueLabel,
  valueWidth = 'w-14',
  palette = 'shades',
  color = DEFAULT_COLOR,
  limit = 5,
  overflow = 'other',
  pageSize = 50,
  other,
  activeKey,
  showHeader = true,
  emptyState = 'No data in this range.',
  isLoading = false,
  LinkComponent,
  className,
}: MetricsShareListProps) {
  const [hover, setHover] = useState<string | null>(null);
  const [count, setCount] = useState(limit);
  const header = showHeader && (
    <div className="flex justify-end">
      <MetricsShareListHeader columns={columns} valueLabel={valueLabel} valueWidth={valueWidth} />
    </div>
  );

  if (isLoading) {
    return (
      <div className={cn('grid gap-4', className)}>
        {header}
        <ShareListSkeleton rows={overflow === 'other' ? limit + 1 : limit} columns={columns} valueWidth={valueWidth} />
      </div>
    );
  }

  // Largest first, so the strongest color is always the biggest share.
  const sorted = [...input].sort((a, b) => b.share - a.share);
  if (sorted.length === 0) {
    return (
      <div className={cn('grid gap-4', className)}>
        {header}
        <Txt variant="body-sm" tone="muted" className="py-6 text-center">
          {emptyState}
        </Txt>
      </div>
    );
  }

  const total = sorted.reduce((sum, r) => sum + Math.max(r.share, 0), 0);
  let shown: Shown[];
  let rest: MetricsShareListRow[] = [];
  let footer: ReactNode = null;

  if (overflow === 'other') {
    // Fold the tail into "Other", unless that would hide a single row (then just show it).
    const folds = sorted.length > limit + 1;
    const head = folds ? sorted.slice(0, limit) : sorted;
    rest = folds ? sorted.slice(limit) : [];
    const colors = rowColors(color, head.length, palette);
    shown = head.map((r, i) => ({ ...r, color: colors[i] ?? REST_COLOR, segment: r.key }));
    if (rest.length) {
      const folded = other?.(rest);
      shown.push({
        key: REST,
        label: `Other (${rest.length})`,
        share: rest.reduce((sum, r) => sum + Math.max(r.share, 0), 0),
        value: folded?.value ?? null,
        cells: folded?.cells,
        color: REST_COLOR,
        segment: REST,
      });
    }
  } else {
    // Page the tail in; the active row stays listed even when it ranks past the shown rows.
    const listed = sorted.slice(0, count);
    const active = activeKey ? sorted.findIndex(r => r.key === activeKey) : -1;
    const pinned = active >= count ? sorted[active] : undefined;
    if (pinned) listed.push(pinned);
    const own = Math.min(count, sorted.length, SEGMENTS);
    const colors = rowColors(color, own, palette);
    const rank = new Map(sorted.map((r, i) => [r.key, i]));
    shown = listed.map(r => {
      const i = rank.get(r.key) ?? sorted.length;
      return { ...r, color: colors[i] ?? REST_COLOR, segment: i < own ? r.key : REST };
    });
    rest = sorted.slice(own);
    footer = (
      <ShowMore
        shown={Math.min(count, sorted.length)}
        total={sorted.length}
        limit={limit}
        pageSize={pageSize}
        onMore={() => setCount(c => c + pageSize)}
        onLess={() => setCount(limit)}
      />
    );
  }

  // Strip segments: one per row with its own color, then everything else in one gray segment.
  const segments = [
    ...shown.filter(r => r.segment !== REST).map(r => ({ key: r.key, share: r.share, color: r.color })),
    ...(rest.length
      ? [{ key: REST, share: rest.reduce((sum, r) => sum + Math.max(r.share, 0), 0), color: REST_COLOR }]
      : []),
  ].filter(s => s.share > 0);
  const hoveredSegment = hover === null ? null : (shown.find(r => r.key === hover)?.segment ?? hover);
  const dimSegment = (key: string) => hoveredSegment !== null && hoveredSegment !== key;
  const dimRow = (r: Shown) => hover !== null && hover !== r.key && !(hover === REST && r.segment === REST);
  const Anchor = LinkComponent ?? 'a';

  return (
    <div className={cn('grid gap-4', className)}>
      {header}
      <div className="flex h-2 gap-0.5" onMouseLeave={() => setHover(null)}>
        {segments.map(s => (
          <span
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            className="h-full min-w-[3px] transition-opacity duration-150 first:rounded-l-full last:rounded-r-full"
            style={{ flex: `${s.share} 1 0`, backgroundColor: s.color, opacity: dimSegment(s.key) ? 0.3 : 1 }}
          />
        ))}
      </div>
      <ul className="grid min-w-0 gap-0.5" onMouseLeave={() => setHover(null)}>
        {shown.map(r => {
          const content = (
            <>
              <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: r.color }} />
              {/* A block line box, like the skeleton's, so loaded and loading rows share a height. */}
              {typeof r.label === 'string' ? (
                <span className="min-w-0 flex-1 truncate" title={r.title ?? r.label}>
                  <Txt as="span" variant="body-sm" tone="ink">
                    {r.label}
                  </Txt>
                </span>
              ) : (
                <span className="flex min-w-0 flex-1" title={r.title}>
                  {r.label}
                </span>
              )}
              {columns.map((c, i) => (
                <span key={c.label} className={cn(NUM, 'text-muted-foreground', c.width ?? 'w-16')}>
                  {r.cells?.[i]}
                </span>
              ))}
              <span className={cn(NUM, 'w-12 text-muted-foreground')}>{fmtShare(r.share, total)}</span>
              <span className={cn(NUM, 'text-foreground', valueWidth)}>{r.value}</span>
            </>
          );
          const highlighted = hover === r.key || activeKey === r.key;
          const rowClass = cn(
            ROW,
            'transition-[background-color,opacity] duration-150',
            highlighted && 'bg-fill-subtle',
            (r.href || r.onClick) && 'hover:bg-fill-subtle',
          );
          const style = { opacity: dimRow(r) ? 0.5 : 1 };
          const enter = () => setHover(r.key);
          return (
            <li key={r.key}>
              {r.href ? (
                <Anchor href={r.href} className={rowClass} style={style} onMouseEnter={enter}>
                  {content}
                </Anchor>
              ) : r.onClick ? (
                <button type="button" onClick={r.onClick} className={rowClass} style={style} onMouseEnter={enter}>
                  {content}
                </button>
              ) : (
                <div className={rowClass} style={style} onMouseEnter={enter}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
        {footer}
      </ul>
    </div>
  );
}

/** The list's last row: pages more rows in, or collapses back to the top rows. */
function ShowMore({
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

const LABEL_WIDTHS = ['w-32', 'w-24', 'w-36', 'w-20', 'w-28'];

/** A skeleton bar centred in a number or label cell's line box. */
function Bar({ className }: { className: string }) {
  return (
    <>
      {'​'}
      <Skeleton className={cn('absolute top-1/2 h-3.5 -translate-y-1/2', className)} />
    </>
  );
}

/** The list while loading, in the real rows' markup (line boxes, paddings, columns). */
function ShareListSkeleton({
  rows,
  columns,
  valueWidth,
}: {
  rows: number;
  columns: MetricsShareListColumn[];
  valueWidth: string;
}) {
  return (
    <>
      <div className="flex h-2">
        <Skeleton className="size-full rounded-full" />
      </div>
      <ul className="grid min-w-0 gap-0.5" aria-busy>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className={ROW}>
            <Skeleton className="size-2 shrink-0 rounded-[2px]" />
            <span className="min-w-0 flex-1">
              <Txt as="span" variant="body-sm" className="relative">
                <Bar className={cn('left-0', LABEL_WIDTHS[i % LABEL_WIDTHS.length])} />
              </Txt>
            </span>
            {columns.map(c => (
              <span key={c.label} className={cn(NUM, 'relative', c.width ?? 'w-16')}>
                <Bar className="right-0 w-10" />
              </span>
            ))}
            <span className={cn(NUM, 'relative w-12')}>
              <Bar className="right-0 w-9" />
            </span>
            <span className={cn(NUM, 'relative', valueWidth)}>
              <Bar className="right-0 w-12" />
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

MetricsShareList.Header = MetricsShareListHeader;
