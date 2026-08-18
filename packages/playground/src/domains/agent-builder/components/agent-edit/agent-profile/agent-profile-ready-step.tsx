import { Button } from '@mastra/playground-ui/components/Button';
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgentStepContainer } from './agent-step-container';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export const AgentProfileReadyStep = () => {
  const { next } = useWizard();
  const navigate = useNavigate();
  const { id: agentId } = useParams<{ id: string }>();
  const sweepRef = useRef<HTMLSpanElement | null>(null);

  // Play the specular sweep exactly once via the Web Animations API. A CSS
  // animation would replay whenever the layout flips into split mode and the
  // view transition repaints this subtree, causing a visible double sweep.
  useEffect(() => {
    const el = sweepRef.current;
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    el.animate(
      [
        { backgroundPosition: '180% 0', opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.88 },
        { backgroundPosition: '-80% 0', opacity: 0 },
      ],
      { duration: 2400, delay: 120, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'both' },
    );
  }, []);

  const handleReview = () => {
    startViewTransition(() => {
      next();
    });
  };

  const handleTry = () => {
    void navigate(`/agent-builder/agents/${agentId}/view`, { viewTransition: true });
  };

  return (
    <AgentStepContainer
      panelClassName="ready-stage"
      panelOverlay={<span ref={sweepRef} className="ready-stage-sweep" aria-hidden="true" />}
      cta={
        <div className="relative z-[2] flex items-center justify-center gap-3">
          <Button variant="outline" onClick={handleReview} data-testid="agent-builder-ready-review">
            Review my agent
          </Button>
          <Button variant="primary" onClick={handleTry} data-testid="agent-builder-ready-try">
            Try my agent
          </Button>
        </div>
      }
    >
      <div className="flex h-full w-full flex-col items-center justify-center px-6 py-6 text-center">
        <div className="ready-stage-content flex flex-col items-center gap-4">
          <h2 className="text-neutral6 text-4xl font-semibold" data-testid="agent-builder-ready-heading">
            Your agent is ready
          </h2>
          <p className="text-neutral3 max-w-md text-lg">
            You can review and fine-tune everything, or jump straight in and try it out.
          </p>
        </div>
      </div>
    </AgentStepContainer>
  );
};
