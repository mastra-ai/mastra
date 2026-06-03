import { Button, cn } from '@mastra/playground-ui';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAgentColor } from '@/domains/agent-builder/contexts/agent-color-context';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export interface AgentStepContainerProps {
  children: React.ReactNode;
  cta: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
}

export const AgentStepContainer = ({ children, cta, title, description }: AgentStepContainerProps) => {
  const agentColor = useAgentColor();
  const isStreaming = useStreamRunning();
  const { isLast, next } = useWizard();
  const navigate = useNavigate();
  const { id: agentId } = useParams<{ id: string }>();

  const bannerStyle: CSSProperties = {
    backgroundImage: `conic-gradient(from 0deg at 50% 50%, ${agentColor.background}, ${agentColor.foreground}, ${agentColor.background})`,
  };

  const showLastStepCtas = isLast && agentId;

  return (
    <div className="relative w-full h-full min-h-0 border border-border1 rounded-3xl overflow-hidden p-4">
      <div
        aria-hidden
        className={cn('agent-step-banner pointer-events-none', isStreaming && 'agent-step-banner-rotating')}
        style={bannerStyle}
      />
      <div
        className={cn(
          'relative h-full overflow-hidden bg-surface3 rounded-2xl grid min-h-0',
          title ? 'grid-rows-[auto_minmax(0,1fr)_auto]' : 'grid-rows-[minmax(0,1fr)_auto]',
        )}
      >
        {title && (
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-3xl font-semibold text-neutral6 pb-1">{title}</h2>
            {description && <p className="text-neutral3">{description}</p>}
          </div>
        )}
        <div className="min-h-0 overflow-y-auto">{children}</div>
        {showLastStepCtas ? (
          <div className="flex justify-center items-center gap-2 shrink-0 pb-6">
            <Button variant="outline" onClick={() => startViewTransition(() => next())} disabled={isStreaming}>
              See agent configuration
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate(`/agent-builder/agents/${agentId}/view`, { viewTransition: true })}
              disabled={isStreaming}
            >
              Try agent
            </Button>
          </div>
        ) : (
          <div className="flex justify-center items-center shrink-0 pb-6">{cta}</div>
        )}
      </div>
    </div>
  );
};
