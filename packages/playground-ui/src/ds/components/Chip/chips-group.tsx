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
        'flex gap-[1px] items-center [&>*:not(:last-child)]:rounded-r-none [&>*:not(:first-child)]:rounded-l-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
