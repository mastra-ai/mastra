import type { ReactNode } from 'react';

/** Shared agent-page grid: tabs above the active chat, traces, or editor view. */
export function AgentPageBody({ tabs, children }: { tabs: ReactNode; children: ReactNode }) {
  return (
    <div
      className={`grid h-full min-h-0 grid-cols-[minmax(0,1fr)] ${tabs ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]'}`}
    >
      {tabs}
      {children}
    </div>
  );
}
