import type { ComponentPropsWithRef, ReactNode } from 'react';

import { useMaybeSidebarState } from '@/ds/components/Sidebar/root/sidebar-context';
import { cn } from '@/lib/utils';

import './app-shell.css';

export interface AppShellProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  children: ReactNode;
  mobileHeader?: ReactNode;
  sidebar?: ReactNode;
}

export function AppShell({ children, className, mobileHeader, ref, sidebar, ...props }: AppShellProps) {
  const sidebarState = useMaybeSidebarState();
  const sidebarHidden = Boolean(sidebar) && Boolean(sidebarState?.isHidden);

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
            'transition-[padding] duration-(--resize-dur) ease-(--resize-ease) motion-reduce:transition-none!',
            'in-data-[sidebar-gesture=active]:transition-none!',
            // Below lg the sidebar is a drawer and the content runs edge to edge under the mobile header.
            // From lg it's inset on every side; with a sidebar column the sidebar's own padding provides the left gap.
            // A hidden sidebar leaves nothing to inset against, so the content runs edge to edge as below lg.
            // Longhands only: consumer CSS that also emits a padding shorthand can't override the lg inset.
            !sidebarHidden && 'lg:py-2 lg:pr-2',
            !sidebarHidden && (sidebar ? 'lg:pl-0' : 'lg:pl-2'),
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
