import { Tabs } from '@base-ui/react/tabs';
import React from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useSidebar } from '../root/sidebar-context';
import { SidebarNavStackContext } from './sidebar-nav-stack-context';
import { cn } from '@/lib/utils';

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
        className={cn('relative grid min-w-0', className)}
        {...props}
      >
        {children}
      </Tabs.Root>
    </SidebarNavStackContext.Provider>
  );
}
