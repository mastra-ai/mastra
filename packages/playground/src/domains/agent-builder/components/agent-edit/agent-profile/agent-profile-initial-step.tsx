import type { ReactNode } from 'react';
import { useAgentColor } from '@/domains/agent-builder/contexts/agent-color-context';

export interface AgentProfileInitialStepProps {
  avatar: ReactNode;
  details: ReactNode;
}

export const AgentProfileInitialStep = ({ avatar, details }: AgentProfileInitialStepProps) => {
  const agentColor = useAgentColor();

  const bannerStyle = agentColor
    ? {
        backgroundImage: `linear-gradient(to bottom right, ${agentColor.background}, ${agentColor.foreground})`,
      }
    : undefined;

  return (
    <div className="w-full h-full" style={bannerStyle}>
      {avatar}
      {details}
    </div>
  );
};
