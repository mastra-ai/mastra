import { PanelRightIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useMainSidebar } from './main-sidebar-context';
import { Kbd } from '@/ds/components/Kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

export type MainSidebarTriggerProps = ComponentPropsWithoutRef<'button'>;

export function MainSidebarTrigger({ className, onClick, ...props }: MainSidebarTriggerProps) {
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
              'flex items-center justify-center rounded-md text-muted-foreground',
              'size-7',
              isCollapsed ? 'mx-auto' : 'ml-auto',
              'hover:bg-sidebar-accent hover:text-foreground',
              'transition-colors duration-normal ease-out-custom motion-reduce:transition-none',
              'focus-visible:shadow-focus-ring focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:outline-hidden',
              '[&_svg]:size-4 [&_svg]:text-muted-foreground [&_svg]:transition-transform [&_svg]:duration-slow [&_svg]:ease-out-custom motion-reduce:[&_svg]:transition-none [&:hover_svg]:text-foreground',
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
        <span className="inline-flex items-center gap-1.5">
          Toggle Sidebar
          <Kbd size="xs" className="border-border bg-muted text-muted-foreground">
            [
          </Kbd>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
