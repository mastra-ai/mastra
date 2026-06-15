import type { ReactNode } from 'react';

export function SidebarPanel({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface3 rounded-tr-studio-panel border border-border1/50 flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
      {children}
    </div>
  );
}
