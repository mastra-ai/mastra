import type { ReactNode } from 'react';

export interface AgentProfileHeroProps {
  children: ReactNode;
}

export const AgentProfileHero = ({ children }: AgentProfileHeroProps) => {
  return (
    <div
      className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border1 bg-surface3 p-4"
      data-testid="agent-profile-hero"
    >
      {children}
    </div>
  );
};
