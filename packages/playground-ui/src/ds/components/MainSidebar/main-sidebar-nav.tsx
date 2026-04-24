import type { ComponentPropsWithoutRef } from 'react';

export type MainSidebarNavProps = ComponentPropsWithoutRef<'nav'>;

export function MainSidebarNav({ 'aria-label': ariaLabel = 'Main', children, ...props }: MainSidebarNavProps) {
  return (
    <nav aria-label={ariaLabel} {...props}>
      {children}
    </nav>
  );
}
