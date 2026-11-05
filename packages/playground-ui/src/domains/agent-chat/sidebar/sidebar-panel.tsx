import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function SidebarPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="sidebar-panel"
      className={cn(
        'ml-px flex min-h-0 min-w-0 flex-col overflow-hidden rounded-tr-studio-panel border-t border-r border-surface-rim bg-card size-full',
        className,
      )}
    >
      {children}
    </div>
  );
}
