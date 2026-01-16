import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { KeyboardIcon, PanelRightIcon } from 'lucide-react';
import { useMainSidebar } from './main-sidebar-context';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

export type MainSidebarRootProps = {
  children: React.ReactNode;
  className?: string;
};
export function MainSidebarRoot({ children, className }: MainSidebarRootProps) {
  const { state, toggleSidebar } = useMainSidebar();
  const isCollapsed = state === 'collapsed';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleSidebar]);

  return (
    <div
      className={cn(
        'flex flex-col h-full px-4 relative overflow-y-auto',
        {
          'lg:min-w-52 xl:min-w-56 2xl:min-w-60 3xl:min-w-64 4xl:min-w-72': !isCollapsed,
        },
        className,
      )}
    >
      {children}

      <div className="bg-surface1 grid sticky bottom-0 pb-3">
        <MainSidebarNavSeparator />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebar}
              className={cn(
                'inline-flex w-auto items-center text-neutral3 h-8 px-3 rounded-md ml-auto',
                'hover:bg-surface4',
                '[&_svg]:w-[1rem] [&_svg]:h-[1rem] [&_svg]:text-neutral3',
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
          </TooltipTrigger>

          <TooltipContent>
            Toggle Sidebar
            <div className="flex items-center gap-1 [&>svg]:w-[1em] [&>svg]:h-[1em]">
              <KeyboardIcon /> Ctrl+B
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

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
