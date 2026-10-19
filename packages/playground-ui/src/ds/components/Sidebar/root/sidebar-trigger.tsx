import { PanelLeftIcon } from 'lucide-react';
import { SidebarButtonHint } from '../header/sidebar-button-hint';
import { useSidebar } from './sidebar-context';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export type SidebarTriggerProps = Omit<ButtonProps, 'variant' | 'size' | 'tooltip' | 'children'>;

export function SidebarTrigger({ className, onClick, ...props }: SidebarTriggerProps) {
  const { desktopState, isMobile, toggleSidebar } = useSidebar();
  const isCollapsed = desktopState === 'collapsed';

  if (isMobile) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle sidebar"
      aria-expanded={!isCollapsed}
      tooltip={<SidebarButtonHint label="Toggle Sidebar" shortcut="[" />}
      tooltipPosition="bottom"
      {...props}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) toggleSidebar();
      }}
      className={cn('shrink-0', !isCollapsed && 'ml-auto', className)}
    >
      <PanelLeftIcon />
    </Button>
  );
}
