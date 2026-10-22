import type { ComponentPropsWithoutRef } from 'react';
import { useSidebar } from '../root/sidebar-context';
import { useSidebarNavStack } from './sidebar-nav-stack-context';
import { sidebarNavStackPageClasses } from './sidebar-nav-stack-page-classes';
import { useNavStackPagePresence } from './use-nav-stack-page-presence';

export type SidebarNavStackRootViewProps = ComponentPropsWithoutRef<'div'>;

export function SidebarNavStackRootView({ children, className, ...props }: SidebarNavStackRootViewProps) {
  const { state } = useSidebar();
  const { activeValue, rootValue } = useSidebarNavStack();
  const active = state === 'collapsed' || activeValue === rootValue;
  const { ref, present, animateIn } = useNavStackPagePresence(active);

  if (!present) return null;

  return (
    <div
      {...props}
      ref={ref}
      data-slot="sidebar-nav-stack-root"
      aria-hidden={!active}
      inert={!active}
      className={sidebarNavStackPageClasses({ active, animateIn, page: 'root', className })}
    >
      {children}
    </div>
  );
}
