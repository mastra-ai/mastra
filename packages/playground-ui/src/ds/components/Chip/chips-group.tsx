import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type ChipsGroupProps = React.ComponentPropsWithoutRef<'div'>;

export const ChipsGroup = forwardRef<HTMLDivElement, ChipsGroupProps>(function ChipsGroup(
  { children, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-[1px] [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
