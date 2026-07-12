import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export function SidebarPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex size-full min-h-0 min-w-0 flex-col overflow-hidden rounded-tr-studio-panel border-t border-r border-border1/50 bg-surface3',
        className,
      )}
    >
      {children}
    </div>
  );
}
