import type { ReactNode } from 'react';

export interface AgentProfileHeroProps {
  avatar: ReactNode;
  details: ReactNode;
  actions?: ReactNode;
}

export const AgentProfileHero = ({ avatar, details, actions }: AgentProfileHeroProps) => {
  return (
    <div data-testid="agent-profile-hero">
      <div
        aria-hidden
        className="h-48 bg-gradient-to-br from-accent3 via-accent5 to-accent6"
        data-testid="agent-profile-hero-banner"
      />
      <div className="flex flex-col items-start gap-3 px-5 pb-5">
        <div className="-mt-9 flex w-full items-center justify-between gap-2">
          {avatar}
          {actions ? (
            <div className="flex items-center gap-2" data-testid="agent-profile-hero-actions">
              {actions}
            </div>
          ) : null}
        </div>
        {details}
      </div>
    </div>
  );
};
