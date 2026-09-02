import { PanelRightIcon } from 'lucide-react';
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
              'flex items-center justify-center rounded-md text-gray-9',
              'size-7',
              isCollapsed ? 'mx-auto' : 'ml-auto',
              'hover:bg-sidebar-nav-hover hover:text-gray-10',
              'transition-all duration-normal ease-out-custom',
              'focus-visible:ring-focus focus-visible:shadow-focus-ring focus-visible:ring-1 focus-visible:outline-hidden',
              '[&_svg]:size-4 [&_svg]:text-gray-9 [&_svg]:transition-transform [&_svg]:duration-normal [&:hover_svg]:text-gray-10',
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

      <TooltipContent>Toggle Sidebar</TooltipContent>
    </Tooltip>
  );
}
