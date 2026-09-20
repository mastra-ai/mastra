import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Kbd } from '@/ds/components/Kbd';
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
          'group inline-flex size-form-md shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent text-muted-foreground transition-colors hover:bg-sidebar-nav-hover hover:text-foreground',
          'focus-visible:shadow-focus-ring focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:outline-hidden',
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
            className="border-border bg-surface-overlay-soft text-muted-foreground group-hover:text-foreground active:scale-100"
          >
            {shortcut}
          </Kbd>
        ) : null}
      </button>
    );
  },
);
