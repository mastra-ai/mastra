import type { CSSProperties } from 'react';
import { useShimmerDelay } from '@/ds/primitives/shimmer';
import { cn } from '@/lib/utils';

function Skeleton({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const delay = useShimmerDelay();
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        // Shimmer: a light band sweeping across, in step with every other skeleton on the page.
        'before:absolute before:inset-0',
        'before:-translate-x-full',
        'before:animate-[shimmer_2s_infinite] before:[animation-delay:var(--shimmer-delay)]',
        'before:bg-linear-to-r before:from-transparent before:via-fill-subtle before:to-transparent',
        className,
      )}
      style={{ '--shimmer-delay': delay, ...style } as CSSProperties}
      {...props}
    />
  );
}

export { Skeleton };
