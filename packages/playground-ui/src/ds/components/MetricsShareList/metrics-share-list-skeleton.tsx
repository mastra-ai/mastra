import { NUM, ROW } from './metrics-share-list-classes';
import type { MetricsShareListColumn } from './metrics-share-list-types';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

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
export function ShareListSkeleton({
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
      <ul className="grid min-w-0 grid-cols-1 gap-0.5" aria-busy>
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
