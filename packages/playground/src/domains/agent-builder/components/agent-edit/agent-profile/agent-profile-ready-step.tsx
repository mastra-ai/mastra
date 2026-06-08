import { Button } from '@mastra/playground-ui';
import { useNavigate, useParams } from 'react-router';
import { AgentStepContainer } from './agent-step-container';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export const AgentProfileReadyStep = () => {
  const { next } = useWizard();
  const navigate = useNavigate();
  const { id: agentId } = useParams<{ id: string }>();

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
      <div className="w-full h-full flex flex-col items-center justify-center py-6 px-6 text-center">
        <div className="ready-stage-content flex flex-col items-center gap-4">
          <h2 className="text-4xl font-semibold text-neutral6" data-testid="agent-builder-ready-heading">
            Your agent is ready
          </h2>
          <p className="text-neutral3 text-lg max-w-md">
            You can review and fine-tune everything, or jump straight in and try it out.
          </p>
        </div>
      </div>
    </AgentStepContainer>
  );
};
