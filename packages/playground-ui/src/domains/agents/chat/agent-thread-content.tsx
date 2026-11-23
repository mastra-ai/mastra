import type { ReactNode } from 'react';

export function AgentThreadContent({ threadId, children }: { threadId: string; children: ReactNode }) {
  return (
    <div key={threadId} className="relative flex h-full min-h-0 flex-col">
      <div className="relative grid min-h-0 flex-1">{children}</div>
    </div>
  );
}
