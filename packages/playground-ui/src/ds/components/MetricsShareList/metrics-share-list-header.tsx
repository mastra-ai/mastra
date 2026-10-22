import type { MetricsShareListHeaderProps } from './metrics-share-list-types';
import { cn } from '@/lib/utils';

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
