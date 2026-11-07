import { useState } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { AppShellMobileBarContext } from './app-shell-mobile-bar-context';
import { AppShellMobileHeader } from './app-shell-mobile-header';
import { useMaybeSidebarState } from '@/ds/components/Sidebar/root/sidebar-context';
import { cn } from '@/lib/utils';

import './app-shell.css';

export interface AppShellProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  children: ReactNode;
  mobileHeader?: ReactNode;
  mobileBrand?: ReactNode;
  mobileActions?: ReactNode;
  sidebar?: ReactNode;
  edgeToEdge?: boolean;
}

export function AppShell({
  children,
  className,
  edgeToEdge,
  mobileActions,
  mobileBrand,
  mobileHeader,
  ref,
  sidebar,
  ...props
}: AppShellProps) {
  const animatesEdgeToEdge = edgeToEdge !== undefined;
  const [pageLayoutCount, setPageLayoutCount] = useState(0);
  const [registerPageLayout] = useState(() => () => {
    setPageLayoutCount(count => count + 1);
    return () => setPageLayoutCount(count => count - 1);
  });
  const isMobile = useMaybeSidebarState()?.isMobile ?? false;
  const mobileBar =
    sidebar && isMobile && mobileHeader === undefined
      ? { brand: mobileBrand, actions: mobileActions, registerPageLayout }
      : undefined;

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
        {mobileBar && pageLayoutCount === 0 && <AppShellMobileHeader brand={mobileBrand} actions={mobileActions} />}
        <div
          data-slot="app-shell-body"
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            animatesEdgeToEdge &&
              'transition-[padding] duration-(--resize-dur) ease-(--resize-ease) motion-reduce:transition-none!',
            animatesEdgeToEdge && 'in-data-[sidebar-gesture=active]:transition-none!',
            // Below lg the sidebar is a drawer and the content runs edge to edge under the mobile header.
            // From lg it's inset on every side; with a sidebar column the sidebar's own padding provides the left gap.
            // Longhands only: consumer CSS that also emits a padding shorthand can't override the lg inset.
            !edgeToEdge && 'lg:py-2 lg:pr-2',
            !edgeToEdge && (sidebar ? 'lg:pl-0' : 'lg:pl-2'),
          )}
        >
          <AppShellMobileBarContext value={mobileBar}>{children}</AppShellMobileBarContext>
        </div>
      </div>
    </div>
  );
}
