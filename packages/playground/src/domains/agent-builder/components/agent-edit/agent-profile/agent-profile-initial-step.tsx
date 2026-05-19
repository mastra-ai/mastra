import { Button } from '@mastra/playground-ui';
import type { ReactNode } from 'react';
import { useAgentColor } from '@/domains/agent-builder/contexts/agent-color-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';

export interface AgentProfileInitialStepProps {
  avatar: ReactNode;
  details: ReactNode;
}

export const AgentProfileInitialStep = ({ avatar, details }: AgentProfileInitialStepProps) => {
  const agentColor = useAgentColor();
  const { next } = useWizard();

  const bannerStyle = agentColor
    ? {
        backgroundImage: `linear-gradient(to bottom right, ${agentColor.background}, ${agentColor.foreground})`,
      }
    : undefined;

  return (
    <div
      className="w-full h-full border border-border1 bg-surface3 rounded-3xl flex flex-col items-center justify-center gap-2 py-6"
      style={bannerStyle}
    >
      {avatar}
      {details}

      <Button onClick={next}>Continue</Button>
    </div>
  );
};
