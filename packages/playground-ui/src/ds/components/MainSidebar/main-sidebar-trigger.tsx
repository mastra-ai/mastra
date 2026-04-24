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
      <TooltipTrigger asChild>
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
            'flex items-center justify-center text-neutral3 rounded-md',
            // Both states share size-9 (36px) — matches NavLink height,
            // so toggling collapse never shifts surrounding rows.
            'size-9',
            isCollapsed ? 'mx-auto' : 'ml-auto',
            'hover:bg-surface4 hover:text-neutral5',
            'transition-all duration-normal ease-out-custom',
            'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:shadow-focus-ring',
            '[&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-neutral3 [&_svg]:transition-transform [&_svg]:duration-normal',
            className,
          )}
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
