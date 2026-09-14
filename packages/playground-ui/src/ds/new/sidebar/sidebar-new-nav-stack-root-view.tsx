import type { ComponentPropsWithoutRef } from 'react';
import { useSidebarNewNavStack } from './sidebar-new-nav-stack-context';
import { sidebarNewNavStackPageClasses } from './sidebar-new-nav-stack-page-classes';
import { useMainSidebar } from '@/ds/components/MainSidebar/main-sidebar-context';

export type SidebarNewNavStackRootViewProps = ComponentPropsWithoutRef<'div'>;

export function SidebarNewNavStackRootView({ children, className, ...props }: SidebarNewNavStackRootViewProps) {
  const { state } = useMainSidebar();
  const { activeValue, rootValue } = useSidebarNewNavStack();
  const active = state === 'collapsed' || activeValue === rootValue;

  return (
    <div
      data-slot="sidebar-new-nav-stack-root"
      aria-hidden={!active}
      inert={!active}
      className={sidebarNewNavStackPageClasses(active, 'root', className)}
      {...props}
    >
      {children}
    </div>
  );
}
