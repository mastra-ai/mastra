import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface AppShellProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  children: ReactNode;
  mobileHeader?: ReactNode;
  sidebar?: ReactNode;
}

export function AppShell({ children, className, mobileHeader, ref, sidebar, ...props }: AppShellProps) {
  return (
    <div
      ref={ref}
      data-slot="app-shell"
      className={cn(
        'h-full min-h-0',
        sidebar && 'lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-[1fr]',
        className,
      )}
      {...props}
    >
      {sidebar}
      <div data-slot="app-shell-content" className="flex h-full min-h-0 min-w-0 flex-col">
        {mobileHeader}
        <div
          data-slot="app-shell-body"
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            // Inset on every side; at lg with a sidebar column the sidebar's own padding provides the left gap.
            // Disjoint longhands: consumer CSS that also emits `.p-1.5` can't override the lg inset.
            'max-lg:p-1.5 lg:py-2 lg:pr-2',
            sidebar ? 'lg:pl-0' : 'lg:pl-2',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
