import { Toolbar } from '@base-ui/react/toolbar';

import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type AvatarRailItemProps = Omit<
  Toolbar.Button.Props,
  'aria-label' | 'aria-current' | 'className' | 'focusableWhenDisabled'
> & {
  'aria-label': string;
  className?: string;
  current?: boolean;
  variant?: 'default' | 'action';
};

export function AvatarRailItem({ current = false, variant = 'default', className, ...props }: AvatarRailItemProps) {
  return (
    <Toolbar.Button
      {...props}
      focusableWhenDisabled={false}
      aria-current={current ? 'true' : undefined}
      data-slot="avatar-rail-item"
      className={cn(
        'relative flex size-10 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full text-muted-foreground',
        'before:absolute before:-inset-0.5 before:rounded-full',
        'not-disabled:hover:bg-fill-subtle not-disabled:hover:text-foreground not-disabled:active:bg-fill',
        'aria-[current=true]:ring-1 aria-[current=true]:ring-foreground aria-[current=true]:ring-inset',
        'not-disabled:focus-visible:bg-fill-subtle not-disabled:focus-visible:text-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        'disabled:cursor-not-allowed disabled:text-placeholder',
        '[&>svg]:size-icon-md',
        variant === 'action' && 'ring-1 ring-border-strong ring-inset',
        controlStateColorTransition,
        className,
      )}
    />
  );
}
