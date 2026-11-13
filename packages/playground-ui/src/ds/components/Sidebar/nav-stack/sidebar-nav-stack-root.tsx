import { Tabs } from '@base-ui/react/tabs';
import React from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useSidebar } from '../root/sidebar-context';
import { SidebarNavStackContext } from './sidebar-nav-stack-context';
import { cn } from '@/lib/utils';

import './sidebar-nav-stack.css';

export type SidebarNavStackProps = ComponentPropsWithoutRef<'div'> & {
  value: string;
  rootValue?: string;
  onValueChange: (value: string) => void;
};

export function SidebarNavStackRoot({
  value,
  rootValue = 'root',
  onValueChange,
  children,
  className,
  ...props
}: SidebarNavStackProps) {
  const { state } = useSidebar();
  // The collapsed rail always shows the root page. When the page changes because the sidebar collapsed or expanded,
  // not because someone opened or left a view, the pages crossfade in place instead of sliding
  // (`sidebar-nav-stack.css`).
  const [last, setLast] = React.useState({ state, value });
  const [instant, setInstant] = React.useState(false);
  if (last.state !== state || last.value !== value) {
    setLast({ state, value });
    setInstant(last.state !== state);
  }

  function closeView(returnFocusRef?: React.RefObject<HTMLElement | null>) {
    onValueChange(rootValue);
    requestAnimationFrame(() => {
      const target = returnFocusRef?.current;
      if (target && !target.closest('[inert]')) target.focus();
    });
  }

  return (
    <SidebarNavStackContext.Provider value={{ activeValue: value, rootValue, closeView }}>
      {/* The collapsed rail always shows the root page's icons. */}
      <Tabs.Root
        value={state === 'collapsed' ? rootValue : value}
        data-slot="sidebar-nav-stack"
        data-value={value}
        data-instant={instant || undefined}
        className={cn('relative grid min-w-0', className)}
        {...props}
      >
        {children}
      </Tabs.Root>
    </SidebarNavStackContext.Provider>
  );
}
