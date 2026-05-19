import type { ReactNode } from 'react';

export interface AgentProfileHeroProps {
  children: ReactNode;
}

export const AgentProfileHero = ({ children }: AgentProfileHeroProps) => {
  return (
    <div data-testid="agent-profile-hero">
      <div
        aria-hidden
        className="h-48 bg-gradient-to-br from-accent3 via-accent5 to-accent6"
        data-testid="agent-profile-hero-banner"
      />
      <div className="-mt-6 flex flex-col items-start gap-3 px-5 pb-5">{children}</div>
    </div>
  );
};
