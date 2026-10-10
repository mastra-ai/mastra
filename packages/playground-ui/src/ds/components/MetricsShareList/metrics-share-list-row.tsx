import type { CSSProperties, ElementType, ReactNode } from 'react';
import { NUM, ROW } from './metrics-share-list-classes';
import type { ShownRow } from './metrics-share-list-rows';
import type { MetricsShareListColumn } from './metrics-share-list-types';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type ShareListRowProps = {
  row: ShownRow;
  columns: MetricsShareListColumn[];
  valueWidth: string;
  /** The row's share, formatted. */
  share: string;
  highlighted: boolean;
  /** The row the list is filtered or narrowed to: announced to screen readers, not just shaded. */
  active?: boolean;
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
  highlighted,
  active = false,
  dimmed,
  onHover,
  LinkComponent,
}: ShareListRowProps) {
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
        aria-current={active || undefined}
      >
        <span
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: row.paint.color, opacity: row.paint.alpha }}
        />
        <RowLabel row={row} />
        {columns.map((c, i) => (
          <span key={c.label} className={cn(NUM, 'text-muted-foreground', c.width ?? 'w-16')}>
            {row.cells?.[i]}
          </span>
        ))}
        <span className={cn(NUM, 'w-12 text-muted-foreground')}>{share}</span>
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
  'aria-current'?: boolean;
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
function RowLabel({ row }: { row: ShownRow }) {
  if (typeof row.label !== 'string') {
    return (
      <span className="flex min-w-0 flex-1" title={row.title}>
        {row.label}
      </span>
    );
  }
  return (
    <span className="min-w-0 flex-1 truncate" title={row.title ?? row.label}>
      <Txt as="span" variant="body-sm" tone="ink">
        {row.label}
      </Txt>
    </span>
  );
}
