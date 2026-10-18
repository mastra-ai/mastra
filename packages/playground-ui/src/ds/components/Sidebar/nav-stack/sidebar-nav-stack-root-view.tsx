import type { ComponentPropsWithoutRef } from 'react';
import { useSidebar } from '../root/sidebar-context';
import { useSidebarNavStack } from './sidebar-nav-stack-context';
import { sidebarNavStackPageClasses } from './sidebar-nav-stack-page-classes';

export type SidebarNavStackRootViewProps = ComponentPropsWithoutRef<'div'>;

export function SidebarNavStackRootView({ children, className, ...props }: SidebarNavStackRootViewProps) {
  const { state } = useSidebar();
  const { activeValue, rootValue } = useSidebarNavStack();
  const active = state === 'collapsed' || activeValue === rootValue;

  return (
    <div
      {...props}
      data-slot="sidebar-nav-stack-root"
      aria-hidden={!active}
      inert={!active}
      className={sidebarNavStackPageClasses(active, 'root', className)}
    >
      {children}
    </div>
  );
}
