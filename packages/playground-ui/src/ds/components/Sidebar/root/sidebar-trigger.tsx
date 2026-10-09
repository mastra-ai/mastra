import { PanelLeftIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useSidebar } from './sidebar-context';
import { Kbd } from '@/ds/components/Kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type SidebarTriggerProps = ComponentPropsWithoutRef<'button'>;

export function SidebarTrigger({ className, onClick, ...props }: SidebarTriggerProps) {
  const { desktopState, isMobile, toggleSidebar } = useSidebar();
  const isCollapsed = desktopState === 'collapsed';

  if (isMobile) return null;

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
              !isCollapsed && 'ml-auto',
              'hover:bg-fill-subtle hover:text-foreground',
              'transition-colors duration-normal ease-out-custom motion-reduce:transition-none',
              focusRing,
              '[&_svg]:size-4 [&_svg]:text-muted-foreground [&:hover_svg]:text-foreground',
              className,
            )}
          >
            <PanelLeftIcon />
          </button>
        }
      />

      <TooltipContent>
        <span className="inline-flex items-center gap-1.5">
          Toggle Sidebar
          <Kbd size="xs" className="bg-muted text-muted-foreground">
            [
          </Kbd>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
