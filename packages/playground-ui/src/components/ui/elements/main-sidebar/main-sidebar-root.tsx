'use client';

import { cn } from '@/lib/utils';
import { PanelRightIcon } from 'lucide-react';
import { useMainSidebar } from './main-sidebar';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';

type MainSidebarRootProps = {
  children: React.ReactNode;
  className?: string;
};
export function MainSidebarRoot({ children, className }: MainSidebarRootProps) {
  const { state, toggleSidebar } = useMainSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <div
      className={cn(
        'flex flex-col h-full px-[1rem] pb-[1rem] relative overflow-y-auto',
        {
          'lg:min-w-[13rem] xl:min-w-[14rem] 2xl:min-w-[15rem] 3xl:min-w-[16rem] 4xl:min-w-[17rem]': !isCollapsed,
        },
        className,
      )}
    >
      {children}

      <MainSidebarNavSeparator />
      <button
        onClick={toggleSidebar}
        className={cn(
          'inline-flex  w-auto items-center text-icon3 h-[2rem] px-[0.75rem] rounded-md',
          'hover:bg-surface4',
          '[&_svg]:w-[1rem] [&_svg]:h-[1rem] [&_svg]:text-icon3',
          {
            'ml-auto': !isCollapsed,
          },
        )}
        aria-label="Toggle sidebar"
      >
        <PanelRightIcon
          className={cn({
            'rotate-180': isCollapsed,
          })}
        />
      </button>
      <button
        onClick={toggleSidebar}
        className={cn('w-[.75rem] h-full right-0 top-0 absolute opacity-10', {
          'cursor-w-resize': !isCollapsed,
          'cursor-e-resize': isCollapsed,
        })}
        aria-label="Toggle sidebar"
      ></button>
    </div>
  );
}
