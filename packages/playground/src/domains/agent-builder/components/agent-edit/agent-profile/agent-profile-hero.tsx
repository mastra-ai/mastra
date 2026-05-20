import { cn } from '@mastra/playground-ui';
import type { ReactNode } from 'react';
import { useAgentColor } from '../../../contexts/agent-color-context';

export interface AgentProfileHeroProps {
  avatar: ReactNode;
  details: ReactNode;
  actions?: ReactNode;
}

export const AgentProfileHero = ({ avatar, details, actions }: AgentProfileHeroProps) => {
  const agentColor = useAgentColor();

  const bannerStyle = agentColor
    ? {
        backgroundImage: `linear-gradient(to bottom right, ${agentColor.background}, ${agentColor.foreground})`,
      }
    : undefined;

  return (
    <div data-testid="agent-profile-hero">
      <div
        aria-hidden
        className={cn('h-1', !agentColor && 'bg-gradient-to-br from-accent3 via-accent5 to-accent6')}
        style={bannerStyle}
        data-testid="agent-profile-hero-banner"
      />
      <div className="flex flex-col items-start gap-3 px-6 py-6">
        <div className="flex w-full items-center justify-between gap-2">
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
