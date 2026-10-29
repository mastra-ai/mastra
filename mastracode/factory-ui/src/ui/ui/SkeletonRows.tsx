import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Fragment } from 'react';
import type { ReactNode } from 'react';

interface SkeletonRowsProps {
  /** Accessible name announced while loading (e.g. "Loading providers"). */
  label: string;
  rows?: number;
  /** Sizing for each placeholder row; defaults to a text-line height. */
  rowClassName?: string;
  className?: string;
  /** A composed row, using the same layout primitives as the loaded content. */
  children?: ReactNode;
}

/**
 * Shared loading placeholder: a `role="status"` region (implicit
 * `aria-live="polite"`) rendering N placeholder rows. Composed rows should
 * mark their decorative content `aria-hidden` so only the status is announced.
 */
export function SkeletonRows({ label, rows = 3, rowClassName = 'h-5 w-full', className, children }: SkeletonRowsProps) {
  return (
    <div role="status" aria-label={label} className={cn('flex flex-col gap-1.5', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Fragment key={i}>
          {children ?? <Skeleton aria-hidden className={cn('motion-reduce:before:animate-none', rowClassName)} />}
        </Fragment>
      ))}
    </div>
  );
}
