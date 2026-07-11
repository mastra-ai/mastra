import { Button } from '@mastra/playground-ui/components/Button';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowLeftIcon } from 'lucide-react';
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
  contentClassName?: string;
  /**
   * Extra classes applied to the inner surface panel. Lets a step decorate the
   * full panel background (e.g. the "ready" step's animated light sweep) without
   * affecting the shared card chrome.
   */
  panelClassName?: string;
  /**
   * Rendered as a direct child of the surface panel, before the content rows,
   * so it spans the whole panel (not clipped by the scrollable content row).
   * Used for full-panel decorations like the "ready" step's light sweep.
   */
  panelOverlay?: ReactNode;
}

export const AgentStepContainer = ({
  children,
  cta,
  title,
  description,
  contentClassName,
  panelClassName,
  panelOverlay,
}: AgentStepContainerProps) => {
  const agentColor = useAgentColor();
  const isStreaming = useStreamRunning();
  const { isLast, next, prev, step, steps } = useWizard();
  const navigate = useNavigate();
  const { id: agentId } = useParams<{ id: string }>();

  const bannerStyle: CSSProperties = {
    backgroundImage: `conic-gradient(from 0deg at 50% 50%, ${agentColor.background}, ${agentColor.foreground}, ${agentColor.background})`,
  };

  const showLastStepCtas = isLast && agentId;
  const canGoBack = steps.indexOf(step) > 0;

  const backButton = canGoBack ? (
    <Button
      variant="ghost"
      onClick={() => startViewTransition(() => prev())}
      disabled={isStreaming}
      data-testid="agent-builder-step-back"
    >
      <Icon>
        <ArrowLeftIcon />
      </Icon>{' '}
      Back
    </Button>
  ) : null;

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
          panelClassName,
        )}
      >
        {panelOverlay}
        {title && (
          <div className="border-b border-border1 px-6 pt-6 pb-4" data-testid="agent-step-title-section">
            <h2 className="text-3xl font-semibold text-neutral6 pb-1">{title}</h2>
            {description && <div className="w-1/2 text-neutral3">{description}</div>}
          </div>
        )}
        <div className={cn('min-h-0 overflow-y-auto', contentClassName)} data-testid="agent-step-content">
          {children}
        </div>
        {showLastStepCtas ? (
          <div
            className="flex justify-center items-center gap-2 shrink-0 border-t border-border1 pt-6 pb-6"
            data-testid="agent-step-footer"
          >
            {backButton}
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
          <div
            className="flex justify-center items-center gap-2 shrink-0 border-t border-border1 pt-6 pb-6"
            data-testid="agent-step-footer"
          >
            {backButton}
            {cta}
          </div>
        )}
      </div>
    </div>
  );
};
