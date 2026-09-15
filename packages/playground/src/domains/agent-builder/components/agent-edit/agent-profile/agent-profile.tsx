import type { ReactNode } from 'react';

export interface AgentProfileProps {
  children: ReactNode;
}

export const AgentProfile = ({ children }: AgentProfileProps) => {
  return (
    <div
      className="border-border1 bg-surface3 grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden rounded-3xl border"
      data-testid="agent-profile"
    >
      {children}
    </div>
  );
};
