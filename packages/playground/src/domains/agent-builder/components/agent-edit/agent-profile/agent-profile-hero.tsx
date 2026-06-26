import type { ReactNode } from 'react';

export interface AgentProfileHeroProps {
  avatar: ReactNode;
  details: ReactNode;
  actions?: ReactNode;
}

export const AgentProfileHero = ({ avatar, details, actions }: AgentProfileHeroProps) => {
  return (
    <div data-testid="agent-profile-hero">
      <div className="flex items-center gap-6 px-6 pt-6 pb-3">
        <div className="shrink-0">{avatar}</div>
        <div className="min-w-0 flex-1">{details}</div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 self-start" data-testid="agent-profile-hero-actions">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
};
