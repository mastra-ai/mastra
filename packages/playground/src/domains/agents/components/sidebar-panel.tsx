import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export function SidebarPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-tr-studio-panel border-t border-r border-border/50 bg-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
