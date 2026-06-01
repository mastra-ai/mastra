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
        'peer group/switch inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-neutral6/[0.14] p-0.5 outline-hidden',
        'transition-[background-color,border-color,transform] duration-normal ease-out-custom motion-reduce:transition-none',
        'hover:scale-[1.015] hover:bg-neutral6/[0.18]',
        'active:scale-[0.99] active:bg-neutral6/[0.22]',
        'focus-visible:border-neutral5/50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-neutral5/55',
        'data-[checked]:bg-neutral6/[0.92]',
        'data-[checked]:hover:bg-neutral6',
        'data-[checked]:active:bg-neutral5',
        'data-[disabled]:cursor-not-allowed data-[disabled]:bg-neutral6/[0.16] data-[disabled]:hover:scale-100 data-[disabled]:hover:bg-neutral6/[0.16] data-[disabled]:active:scale-100',
        'data-[disabled]:data-[checked]:bg-neutral6/[0.3] data-[disabled]:data-[checked]:hover:bg-neutral6/[0.3]',
        className,
      )}
      {...renderProps}
      {...props}
    >
      {asChild ? undefined : children}
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-neutral6',
          'transition-[background-color,transform,width] duration-normal ease-out-custom motion-reduce:transition-none',
          'group-hover/switch:scale-[1.03] group-active/switch:w-5 group-active/switch:scale-100 group-data-[disabled]/switch:w-4 group-data-[disabled]/switch:scale-100',
          'data-[checked]:translate-x-4 data-[checked]:bg-surface1 data-[unchecked]:translate-x-0',
          'group-active/switch:data-[checked]:translate-x-3',
          'data-[disabled]:data-[unchecked]:bg-neutral6/[0.42] data-[disabled]:data-[checked]:bg-surface1/80',
        )}
      />
    </SwitchPrimitive.Root>
  );
});
Switch.displayName = 'Switch';

export { Switch };
export type { SwitchProps };
