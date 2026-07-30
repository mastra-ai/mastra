import { KeyboardIcon, PanelRightIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useMainSidebar } from './main-sidebar-context';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

export type MainSidebarTriggerProps = ComponentPropsWithoutRef<'button'>;

export function MainSidebarTrigger({ className, onClick, ...props }: MainSidebarTriggerProps) {
  // Use desktopState so the icon reflects the persisted desktop state
  // even on mobile (where `state` is forced to 'default' for the drawer).
  const { desktopState, toggleSidebar } = useMainSidebar();
  const isCollapsed = desktopState === 'collapsed';

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Toggle sidebar"
            aria-expanded={!isCollapsed}
            {...props}
            onClick={event => {
              onClick?.(event);
              if (!event.defaultPrevented) toggleSidebar();
            }}
            className={cn(
              'flex items-center justify-center rounded-md text-neutral3',
              'size-7',
              isCollapsed ? 'mx-auto' : 'ml-auto',
              'hover:bg-sidebar-nav-hover hover:text-neutral6',
              'duration-normal transition-all ease-out-custom',
              'focus-visible:shadow-focus-ring focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:outline-hidden',
              '[&_svg]:duration-normal [&_svg]:size-4 [&_svg]:text-neutral3 [&_svg]:transition-transform [&:hover_svg]:text-neutral5',
              className,
            )}
          >
            <PanelRightIcon
              className={cn({
                'rotate-180': isCollapsed,
              })}
            />
          </button>
        }
      />

      <TooltipContent>
        Toggle Sidebar
        <div className="flex items-center gap-1 [&>svg]:size-[1em]">
          <KeyboardIcon /> Ctrl+B
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
