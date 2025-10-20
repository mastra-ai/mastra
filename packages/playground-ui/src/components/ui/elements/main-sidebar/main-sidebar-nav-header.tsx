'use client';

import { cn } from '@/lib/utils';
import { type SidebarState } from './main-sidebar-context';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';

type MainSidebarNavHeaderProps = {
  children?: React.ReactNode;
  className?: string;
  state?: SidebarState;
};
export function MainSidebarNavHeader({ children, className, state = 'default' }: MainSidebarNavHeaderProps) {
  const isDefaultState = state === 'default';

  return (
    <div className={cn('grid grid-cols-[auto_1fr] items-center min-h-[2.8rem] ', className)}>
      <header
        className={cn('text-[0.6875rem] uppercase text-icon3/75 tracking-widest', {
          'pl-[0.75rem]': isDefaultState,
        })}
      >
        {isDefaultState ? children : <VisuallyHidden>{children}</VisuallyHidden>}
      </header>
      <MainSidebarNavSeparator />
    </div>
  );
}
