import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md bg-surface4 relative overflow-hidden',
        // Shimmer effect using pseudo-element
        'before:absolute before:inset-0',
        'before:translate-x-[-100%]',
        'before:animate-[shimmer_2s_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-surface5/20 before:to-transparent',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
