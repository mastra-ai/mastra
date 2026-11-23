import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

export type SkeletonTextProps = {
  /** Type style of the text it stands in for (e.g. `text-body-sm`), which sets the line's height. */
  line?: string;
  /** Size of the bar itself, e.g. `h-3.5 w-24`. */
  className?: string;
};

/**
 * A skeleton bar inside a line of text: the line takes the real text's height, the bar sits
 * centred in it, so nothing moves when the text arrives.
 */
export function SkeletonText({ line = 'text-body-sm', className }: SkeletonTextProps) {
  return (
    <span className={cn('flex items-center', line)}>
      <span aria-hidden>{'​'}</span>
      <Skeleton className={cn('h-3.5', className)} />
    </span>
  );
}
