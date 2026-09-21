import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Kbd } from '@/ds/components/Kbd';
import { controlStateColorTransition, focusRing } from '@/ds/primitives/transitions';
import { quietTextHover, quietTextHoverInGroup } from '@/ds/primitives/typography';
import { cn } from '@/lib/utils';

export type SidebarNewSearchTriggerProps = ComponentPropsWithoutRef<'button'> & {
  shortcut?: ReactNode;
};

export const SidebarNewSearchTrigger = forwardRef<HTMLButtonElement, SidebarNewSearchTriggerProps>(
  function SidebarNewSearchTrigger({ className, children, shortcut, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        data-slot="sidebar-new-search-trigger"
        type={type}
        className={cn(
          'group inline-flex size-control-md shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent hover:bg-fill-subtle',
          quietTextHover,
          controlStateColorTransition,
          focusRing.visible,
          '[&_svg]:size-4 [&_svg]:shrink-0',
          shortcut && 'w-auto px-2',
          className,
        )}
        {...props}
      >
        {children}
        {shortcut ? (
          <Kbd
            size="xs"
            className={cn('bg-surface-overlay-soft active:scale-100', quietTextHoverInGroup)}
          >
            {shortcut}
          </Kbd>
        ) : null}
      </button>
    );
  },
);
