import { cn } from '@mastra/playground-ui';
import type { CSSProperties, ReactNode } from 'react';
import { useAgentColor } from '@/domains/agent-builder/contexts/agent-color-context';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';

export interface AgentStepContainerProps {
  children: React.ReactNode;
  cta: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
}

export const AgentStepContainer = ({ children, cta, title, description }: AgentStepContainerProps) => {
  const agentColor = useAgentColor();
  const isStreaming = useStreamRunning();

  const bannerStyle: CSSProperties = {
    backgroundImage: `conic-gradient(from 0deg at 50% 50%, ${agentColor.background}, ${agentColor.foreground}, ${agentColor.background})`,
  };

  return (
    <div className="relative w-full h-full min-h-0 border border-border1 rounded-3xl overflow-hidden p-4">
      <div
        aria-hidden
        className={cn(
          'agent-step-banner pointer-events-none',
          isStreaming && 'agent-step-banner-rotating',
        )}
        style={bannerStyle}
      />
      <div
        className={cn(
          'relative h-full overflow-y-auto bg-surface3 rounded-2xl grid ',
          title ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[1fr_auto]',
        )}
      >
        {title && (
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-3xl font-semibold text-neutral6 pb-1">{title}</h2>
            {description && <p className="text-neutral3">{description}</p>}
          </div>
        )}
        <div className="h-full overflow-y-auto">{children}</div>
        <div className="flex justify-center items-center shrink-0 pb-6">{cta}</div>
      </div>
    </div>
  );
};
