import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { ProcessStepList, ProcessStepProgressBar } from '@mastra/playground-ui/components/Steps';
import type { ProcessStep } from '@mastra/playground-ui/components/Steps';
import { cn } from '@mastra/playground-ui/utils/cn';
import { OctagonXIcon } from 'lucide-react';
import { Container } from './shared';

type TemplateInstallationProps = {
  name: string;
  streamResult?: any;
  runId?: string;
  workflowInfo?: any;
};

export function TemplateInstallation({ name, streamResult, runId, workflowInfo }: TemplateInstallationProps) {
  const phase = streamResult?.phase || 'initializing';
  const workflowState = streamResult?.payload?.workflowState;
  const currentStep = streamResult?.payload?.currentStep;
  const error = streamResult?.error;

  // Get steps from the workflow state
  const workflowSteps = workflowState?.steps || {};
  const hasSteps = Object.keys(workflowSteps).length > 0;

  // Filter out internal workflow steps using workflow info if available
  const isUserVisibleStep = (stepId: string) => {
    // Filter out input steps
    if (stepId === 'input' || stepId.endsWith('.input')) return false;

    // Filter out auto-generated mapping steps (they contain random hex IDs)
    if (stepId.startsWith('Mapping_') && /[0-9a-f]{8}/.test(stepId)) return false;

    // Filter out other internal workflow steps with hex IDs
    if (/[0-9a-f]{8,}/.test(stepId)) return false;

    // If we have workflow info, use it to determine visibility
    if (workflowInfo?.allSteps) {
      return stepId in workflowInfo.allSteps;
    }

    // If no workflow info available, show all non-internal steps
    return true;
  };

  const visibleSteps = Object.entries(workflowSteps).filter(([stepId, _]) => isUserVisibleStep(stepId));
  const totalSteps = visibleSteps.length;

  const getPhaseMessage = () => {
    switch (phase) {
      case 'initializing':
        return 'Preparing template installation...';
      case 'processing':
        return `Installing ${name} template`;
      case 'completed':
        return 'Template installation completed!';
      case 'error':
        return 'Template installation failed';
      default:
        return 'Installing template...';
    }
  };

  const steps: ProcessStep[] = visibleSteps.map(([stepId, stepData]: [string, any]) => ({
    id: stepId,
    status: stepData?.status,
    description: stepData?.description,
    title: stepId.charAt(0).toUpperCase() + stepId.slice(1).replace(/-/g, ' '),
    isActive: currentStep?.id === stepId,
  }));

  return (
    <Container className="mb-8 content-center space-y-6 text-neutral3">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-neutral5">{getPhaseMessage()}</h3>
        {(streamResult?.runId || runId) && (
          <div className="mt-2 text-ui-sm text-neutral3">Run ID: {streamResult?.runId ?? runId}</div>
        )}
      </div>

      {/* Progress Bar */}
      {hasSteps && totalSteps > 0 && !['error'].includes(phase) && (
        <div className="max-w-120 mx-auto w-full px-6">
          <ProcessStepProgressBar steps={steps} />
        </div>
      )}

      {/* Error Display */}
      {error && phase === 'error' && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg bg-red-500/10 p-6 text-ui-md text-neutral5',
            '[&>svg]:size-6 [&>svg]:text-red-500 [&>svg]:opacity-70',
          )}
        >
          <OctagonXIcon />
          {error || 'Something went wrong'}
        </div>
      )}

      {/* Dynamic Steps Display */}
      {hasSteps && <ProcessStepList steps={steps} currentStep={currentStep} className="pb-4" />}

      {/* Simple loading state for initialization */}
      {!hasSteps && phase === 'initializing' && (
        <div className="grid justify-items-center gap-4 text-center text-sm text-neutral3">
          <Spinner />
          <p>This may take some time...</p>
        </div>
      )}
    </Container>
  );
}
