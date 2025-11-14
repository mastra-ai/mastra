import { Container } from './shared';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { ProcessStepList, ProcessStepProgressBar, type ProcessStep } from '@/components/ui/elements/steps';
import { OctagonXIcon } from 'lucide-react';

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
    <Container className="space-y-6 text-icon3 mb-[2rem] content-center">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-icon5">{getPhaseMessage()}</h3>
        {streamResult?.runId && (
          <div className="mt-[0.5rem] text-[0.75rem] text-icon3">Run ID: {streamResult.runId}</div>
        )}
      </div>

      {/* Progress Bar */}
      {hasSteps && totalSteps > 0 && !['error'].includes(phase) && (
        <div className="max-w-[30rem] w-full mx-auto px-[1.5rem]">
          <ProcessStepProgressBar steps={steps} />
        </div>
      )}

      {/* Error Display */}
      {error && phase === 'error' && (
        <div
          className={cn(
            'rounded-lg text-icon5 p-[1.5rem] flex items-center gap-[.75rem] text-[0.875rem] bg-red-500/10',
            '[&>svg]:w-[1.5rem] [&>svg]:h-[1.5rem] [&>svg]:opacity-70 [&>svg]:text-red-500',
          )}
        >
          <OctagonXIcon />
          {error || 'Something went wrong'}
        </div>
      )}

      {/* Dynamic Steps Display */}
      {hasSteps && <ProcessStepList steps={steps} currentStep={currentStep} className="pb-[1rem]" />}

      {/* Simple loading state for initialization */}
      {!hasSteps && phase === 'initializing' && (
        <div className="text-center text-sm text-icon3 grid gap-[1rem] justify-items-center">
          <Spinner />
          <p>This may take some time...</p>
        </div>
      )}
    </Container>
  );
}
