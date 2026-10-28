import type { CSSProperties, ElementType, ReactNode } from 'react';
import { FIXED_LABEL, NUM, ROW } from './metrics-share-list-classes';
import type { ShownRow } from './metrics-share-list-rows';
import type { MetricsShareListColumn } from './metrics-share-list-types';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type ShareListRowProps = {
  row: ShownRow;
  columns: MetricsShareListColumn[];
  valueWidth: string;
  /** The row's share, formatted; no Share column when unset. */
  share?: string;
  /** The colour swatch keying the row to the strip. */
  swatch: boolean;
  highlighted: boolean;
  dimmed: boolean;
  onHover: () => void;
  LinkComponent?: ElementType;
};

/** One ranked row: swatch, label, extra cells, share and value. */
export function ShareListRow({
  row,
  columns,
  valueWidth,
  share,
  swatch,
  highlighted,
  dimmed,
  onHover,
  LinkComponent,
}: ShareListRowProps) {
  const hasLeft = columns.some(c => c.align === 'left');
  const className = cn(
    ROW,
    'transition-[background-color,opacity] duration-150',
    highlighted && 'bg-fill-subtle',
    (row.href || row.onClick) && 'hover:bg-fill-subtle',
  );
  return (
    <li>
      <RowShell
        row={row}
        LinkComponent={LinkComponent}
        className={className}
        style={{ opacity: dimmed ? 0.5 : 1 }}
        onMouseEnter={onHover}
      >
        {swatch && (
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: row.paint.color, opacity: row.paint.alpha }}
          />
        )}
        <RowLabel row={row} fixed={hasLeft} />
        {columns.map((c, i) =>
          c.align === 'left' ? (
            <span key={c.label} className={cn('min-w-0 shrink-0 truncate', c.width ?? 'w-16')}>
              <Txt as="span" variant="body-sm" tone="muted">
                {row.cells?.[i]}
              </Txt>
            </span>
          ) : null,
        )}
        {hasLeft && <span aria-hidden className="flex-1" />}
        {columns.map((c, i) =>
          c.align === 'left' ? null : (
            <span
              key={c.label}
              className={cn(NUM, c.emphasis ? 'text-foreground' : 'text-muted-foreground', c.width ?? 'w-16')}
            >
              {row.cells?.[i]}
            </span>
          ),
        )}
        {share !== undefined && <span className={cn(NUM, 'w-12 text-muted-foreground')}>{share}</span>}
        <span className={cn(NUM, 'text-foreground', valueWidth)}>{row.value}</span>
      </RowShell>
    </li>
  );
}

/** A link for `href` rows, a button for `onClick` rows, a plain row otherwise. */
function RowShell({
  row,
  LinkComponent,
  ...props
}: {
  row: ShownRow;
  LinkComponent?: ElementType;
  className: string;
  style: CSSProperties;
  onMouseEnter: () => void;
  children: ReactNode;
}) {
  if (row.href) {
    const Anchor = LinkComponent ?? 'a';
    return <Anchor href={row.href} {...props} />;
  }
  if (row.onClick) return <button type="button" onClick={row.onClick} {...props} />;
  return <div {...props} />;
}

/** A block line box, like the skeleton's, so loaded and loading rows share a height. */
function RowLabel({ row, fixed }: { row: ShownRow; fixed: boolean }) {
  const width = fixed ? FIXED_LABEL : 'flex-1';
  if (typeof row.label !== 'string') {
    return (
      <span className={cn('flex min-w-0', width)} title={row.title}>
        {row.label}
      </span>
    );
  }
  return (
    <span className={cn('min-w-0 truncate', width)} title={row.title ?? row.label}>
      <Txt as="span" variant="body-sm" tone="ink">
        {row.label}
      </Txt>
    </span>
  );
}
