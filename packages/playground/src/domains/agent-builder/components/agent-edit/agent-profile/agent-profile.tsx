import type { ReactNode } from 'react';

export interface AgentProfileProps {
  children: ReactNode;
}

export const AgentProfile = ({ children }: AgentProfileProps) => {
  return (
    <div
      className="grid grid-rows-[auto_1fr] gap-4 border border-border1 bg-surface2 rounded-3xl p-6 h-full min-h-0"
      data-testid="agent-profile"
    >
      {children}
    </div>
  );
};
