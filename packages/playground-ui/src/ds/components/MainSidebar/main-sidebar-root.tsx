import { useMainSidebar } from './main-sidebar-context';
import { cn } from '@/lib/utils';

export type MainSidebarRootProps = {
  children: React.ReactNode;
  className?: string;
};
export function MainSidebarRoot({ children, className }: MainSidebarRootProps) {
  const { state, toggleSidebar } = useMainSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <div
      className={cn(
        'flex flex-col h-full px-4 relative overflow-y-auto',
        // Smooth width transition for collapse/expand
        'transition-all duration-slow ease-out-custom',
        {
          'lg:min-w-52 xl:min-w-56 2xl:min-w-60 3xl:min-w-64 4xl:min-w-72': !isCollapsed,
        },
        className,
      )}
    >
      {children}

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
