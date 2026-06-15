import type { ReactNode } from 'react';

/**
 * Shared shell for the agent page left sidebar (threads/memory and playground
 * config): flush against the left and bottom edges of the layout, with a
 * single rounded top-right corner.
 */
export function SidebarPanel({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface3 rounded-tr-studio-panel border border-border1/50 flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
      {children}
    </div>
  );
}
