import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

interface SkeletonRowsProps {
  /** Accessible name announced while loading (e.g. "Loading providers"). */
  label: string;
  rows?: number;
  /** Sizing for each placeholder row; defaults to a text-line height. */
  rowClassName?: string;
}

/**
 * Shared loading placeholder: a `role="status"` region (implicit
 * `aria-live="polite"`) rendering N shimmering Skeleton rows. Every
 * data-loading state in the web UI renders through this so tests can query
 * `getByRole('status', { name: 'Loading …' })` uniformly.
 */
export function SkeletonRows({ label, rows = 3, rowClassName = 'h-5 w-full' }: SkeletonRowsProps) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-1.5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={rowClassName} />
      ))}
    </div>
  );
}
