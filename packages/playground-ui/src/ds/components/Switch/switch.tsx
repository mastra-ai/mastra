import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import * as React from 'react';

import { formElementFocus } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';
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
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
        transitions.all,
        formElementFocus,
        'hover:brightness-110',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100',
        'data-[checked]:bg-accent1 data-[checked]:shadow-glow-accent1',
        'data-[unchecked]:bg-neutral2',
        className,
      )}
      {...renderProps}
      {...props}
    >
      {asChild ? undefined : children}
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-md',
          'transition-all duration-normal ease-out-custom',
          'data-[checked]:translate-x-4 data-[unchecked]:translate-x-0',
          'data-[checked]:shadow-lg',
        )}
      />
    </SwitchPrimitive.Root>
  );
});
Switch.displayName = 'Switch';

export { Switch };
export type { SwitchProps };
