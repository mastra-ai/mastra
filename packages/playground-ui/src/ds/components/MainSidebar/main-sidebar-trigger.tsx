import { KeyboardIcon, PanelRightIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useMainSidebar } from './main-sidebar-context';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

export type MainSidebarTriggerProps = {
  className?: string;
};

export function MainSidebarTrigger({ className }: MainSidebarTriggerProps) {
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleSidebar}
          className={cn(
            'inline-flex w-auto items-center text-neutral3 h-8 px-3 rounded-md',
            'hover:bg-surface4 hover:text-neutral5',
            'transition-all duration-normal ease-out-custom',
            'focus:outline-hidden focus:ring-1 focus:ring-accent1 focus:shadow-focus-ring',
            '[&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-neutral3 [&_svg]:transition-transform [&_svg]:duration-normal',
            className,
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
  );
}
