import React from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { SidebarNewNavStackContext } from './sidebar-new-nav-stack-context';
import { cn } from '@/lib/utils';

export type SidebarNewNavStackProps = ComponentPropsWithoutRef<'div'> & {
  value: string;
  rootValue?: string;
  onValueChange: (value: string) => void;
};

export function SidebarNewNavStackRoot({
  value,
  rootValue = 'root',
  onValueChange,
  children,
  className,
  ...props
}: SidebarNewNavStackProps) {
  function closeView(returnFocusRef?: React.RefObject<HTMLElement | null>) {
    onValueChange(rootValue);
    requestAnimationFrame(() => {
      const target = returnFocusRef?.current;
      if (target && !target.closest('[inert]')) target.focus();
    });
  }

  return (
    <SidebarNewNavStackContext.Provider value={{ activeValue: value, rootValue, closeView }}>
      <div
        data-slot="sidebar-new-nav-stack"
        data-value={value}
        className={cn('relative grid min-w-0 overflow-hidden', className)}
        {...props}
      >
        {children}
      </div>
    </SidebarNewNavStackContext.Provider>
  );
}
