import type { ReactNode } from 'react';

export interface AgentProfileProps {
  children: ReactNode;
}

export const AgentProfile = ({ children }: AgentProfileProps) => {
  return (
    <div
      className="grid grid-rows-[auto_1fr] border border-border1 bg-surface3 rounded-3xl h-full min-h-0 overflow-hidden"
      data-testid="agent-profile"
    >
      {children}
    </div>
  );
};
