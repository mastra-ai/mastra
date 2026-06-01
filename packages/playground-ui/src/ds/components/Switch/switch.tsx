import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import * as React from 'react';

import { cn } from '@/lib/utils';

type SwitchProps = Omit<SwitchPrimitive.Root.Props, 'className'> & {
  className?: string;
  asChild?: boolean;
};

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ className, asChild, children, ...props }, ref) => {
  // Base UI's Switch.Root defaults to a `<span>` and forwards `id` to its
  // hidden checkbox input. Render a native `<button>` (with `nativeButton`) so
  // the consumer's `id` — and the click target — lands on the visible control,
  // matching the previous Radix behavior.
  const renderProps =
    asChild && React.isValidElement(children)
      ? { render: children as React.ReactElement }
      : { render: <button type="button" />, nativeButton: true };

  return (
    <SwitchPrimitive.Root
      ref={ref}
      data-slot="switch"
      className={cn(
        'peer group/switch inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-neutral6/[0.08] bg-neutral6/[0.12] p-0.5 outline-hidden',
        'transition-[background-color,border-color,transform] duration-normal ease-out-custom motion-reduce:transition-none',
        'hover:scale-[1.02] hover:border-neutral6/[0.12] hover:bg-neutral6/[0.16]',
        'active:scale-[0.98] active:border-neutral6/[0.18] active:bg-neutral6/[0.18]',
        'focus-visible:border-neutral5/50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-neutral5/55',
        'data-[checked]:border-neutral6 data-[checked]:bg-neutral6',
        'data-[checked]:hover:border-neutral5 data-[checked]:hover:bg-neutral5',
        'data-[checked]:active:border-neutral4 data-[checked]:active:bg-neutral4',
        'data-[disabled]:cursor-not-allowed data-[disabled]:border-neutral6/[0.2] data-[disabled]:bg-neutral6/[0.14] data-[disabled]:hover:scale-100 data-[disabled]:hover:border-neutral6/[0.2] data-[disabled]:hover:bg-neutral6/[0.14] data-[disabled]:active:scale-100',
        'data-[disabled]:data-[checked]:border-neutral6/[0.38] data-[disabled]:data-[checked]:bg-neutral6/[0.38] data-[disabled]:data-[checked]:hover:border-neutral6/[0.38] data-[disabled]:data-[checked]:hover:bg-neutral6/[0.38]',
        className,
      )}
      {...renderProps}
      {...props}
    >
      {asChild ? undefined : children}
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-neutral6',
          'transition-[background-color,transform] duration-normal ease-out-custom motion-reduce:transition-none',
          'group-hover/switch:scale-105 group-active/switch:scale-95 group-data-[disabled]/switch:scale-100',
          'data-[checked]:translate-x-4 data-[checked]:bg-surface1 data-[unchecked]:translate-x-0',
          'data-[disabled]:data-[unchecked]:bg-neutral6/[0.5] data-[disabled]:data-[checked]:bg-surface1/80',
        )}
      />
    </SwitchPrimitive.Root>
  );
});
Switch.displayName = 'Switch';

export { Switch };
export type { SwitchProps };
