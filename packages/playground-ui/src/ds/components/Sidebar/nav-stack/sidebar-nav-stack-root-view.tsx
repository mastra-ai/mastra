import { Tabs } from '@base-ui/react/tabs';
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
    <Tabs.Panel
      {...props}
      value={rootValue}
      role={undefined}
      tabIndex={undefined}
      data-slot="sidebar-nav-stack-root"
      aria-hidden={!active}
      className={sidebarNavStackPageClasses('root', className)}
    >
      {children}
    </Tabs.Panel>
  );
}
