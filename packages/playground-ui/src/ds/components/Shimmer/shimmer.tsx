import { useRef, type ComponentProps } from 'react';

import { cn } from '@/lib/utils';

import './shimmer.css';

export interface ShimmerProps extends ComponentProps<'span'> {
  /** Sweeping while true; when it turns false the sweep settles where it stands. */
  active?: boolean;
}

/**
 * Text that says it is still being produced. One element whatever the state: swapping
 * it for a plain span once the work lands would remount everything it wraps, replaying
 * the entrance of every row and detail inside it.
 */
export const Shimmer = ({ active = true, className, ...props }: ShimmerProps) => {
  const swept = useRef(active);
  if (active) swept.current = true;

  return (
    <span
      className={cn(
        'inline-block',
        swept.current && 'shimmer-text',
        swept.current && !active && 'shimmer-settled',
        className,
      )}
      {...props}
    />
  );
};
