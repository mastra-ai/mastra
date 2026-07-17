import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import * as React from 'react';

import { cn } from '@/lib/utils';
import './switch.css';

type SwitchProps = Omit<SwitchPrimitive.Root.Props, 'className'> & {
  className?: string;
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
  asChild?: boolean;
  icon?: React.ReactNode;
  checkedIcon?: React.ReactNode;
  uncheckedIcon?: React.ReactNode;
};

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, asChild, children, icon, checkedIcon, uncheckedIcon, ...props }, ref) => {
    const shouldRenderStateIcons = checkedIcon !== undefined || uncheckedIcon !== undefined;
    const shouldRenderIcon = icon !== undefined || shouldRenderStateIcons;

    const singleIcon = shouldRenderStateIcons ? undefined : icon;
    const onIcon = checkedIcon ?? icon;
    const offIcon = uncheckedIcon ?? icon;

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
          'peer group/switch inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-0 bg-neutral6/[0.14] p-0.5 outline-hidden',
          'duration-normal transition-colors ease-out-custom motion-reduce:transition-none',
          'hover:bg-neutral6/[0.18]',
          'active:bg-neutral6/[0.22]',
          'focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-neutral5/55 focus-visible:outline-solid',
          'data-[checked]:bg-neutral6/[0.92]',
          'data-[checked]:hover:bg-neutral6',
          'data-[checked]:active:bg-neutral5',
          'data-[disabled]:cursor-not-allowed data-[disabled]:bg-neutral6/[0.16] data-[disabled]:hover:bg-neutral6/[0.16]',
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
            'switch-thumb-motion pointer-events-none relative block h-4 w-5 rounded-full bg-neutral6',
            'duration-normal transition-[background-color,translate,width,transform] ease-out-custom motion-reduce:transition-none',
            'group-active/switch:w-6 group-data-[disabled]/switch:w-5',
            'data-[checked]:translate-x-3 data-[checked]:bg-surface1 data-[unchecked]:translate-x-0',
            'group-active/switch:data-[checked]:translate-x-2',
            'data-[disabled]:data-[checked]:bg-surface1/80 data-[disabled]:data-[unchecked]:bg-neutral6/[0.42]',
          )}
        >
          {shouldRenderIcon ? <SwitchThumbIcon checkedIcon={onIcon} icon={singleIcon} uncheckedIcon={offIcon} /> : null}
        </SwitchPrimitive.Thumb>
      </SwitchPrimitive.Root>
    );
  },
);
Switch.displayName = 'Switch';

function SwitchThumbIcon({
  checkedIcon,
  icon,
  uncheckedIcon,
}: {
  checkedIcon?: React.ReactNode;
  icon?: React.ReactNode;
  uncheckedIcon?: React.ReactNode;
}) {
  const iconClassName = cn(
    'absolute inset-0 flex items-center justify-center text-surface1',
    'duration-normal transition-[color,opacity] ease-out-custom motion-reduce:transition-none',
    '[&_svg]:stroke-2.5 [&_svg]:size-2.5',
  );

  if (icon !== undefined) {
    return (
      <span
        aria-hidden
        data-slot="switch-thumb-icon"
        className={cn(iconClassName, 'group-data-[checked]/switch:text-neutral6')}
      >
        {icon}
      </span>
    );
  }

  return (
    <>
      {uncheckedIcon !== undefined ? (
        <span
          aria-hidden
          data-slot="switch-thumb-icon"
          data-switch-icon="unchecked"
          className={cn(iconClassName, 'opacity-100 group-data-[checked]/switch:opacity-0')}
        >
          {uncheckedIcon}
        </span>
      ) : null}
      {checkedIcon !== undefined ? (
        <span
          aria-hidden
          data-slot="switch-thumb-icon"
          data-switch-icon="checked"
          className={cn(iconClassName, 'text-neutral6 opacity-0 group-data-[checked]/switch:opacity-100')}
        >
          {checkedIcon}
        </span>
      ) : null}
    </>
  );
}

export { Switch };
export type { SwitchProps };
