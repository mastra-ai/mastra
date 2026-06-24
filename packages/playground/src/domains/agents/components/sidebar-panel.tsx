import { cn } from '@mastra/playground-ui';
import type { ReactNode } from 'react';

export function SidebarPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-surface3 rounded-tr-studio-panel border-t border-r border-border1/50 flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}
