import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export function SidebarPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="sidebar-panel"
      className={cn(
        'ml-px flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-tr-studio-panel border-t border-r border-surface-rim bg-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
