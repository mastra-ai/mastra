import { Container } from './shared';
import Spinner from '@/components/ui/spinner';
import { useEffect, useRef, createRef } from 'react';

type TemplateInstallationProps = {
  name: string;
  streamResult?: any;
  runId?: string;
  workflowInfo?: any;
};

function TemplateStepStatus({
  stepId,
  stepData,
  isActive,
  stepRef,
}: {
  stepId: string;
  stepData: any;
  isActive: boolean;
  stepRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Spinner className="w-4 h-4 text-accent6" />;
      case 'success':
        return <span className="text-accent1 text-sm">✓</span>;
      case 'failed':
        return <span className="text-accent2 text-sm">✗</span>;
      case 'pending':
        return <span className="text-icon2 text-sm">○</span>;
      default:
        return <span className="text-icon2 text-sm">○</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-surface3 ring-2 ring-accent6 bg-accent6Darker';
      case 'success':
        return 'bg-surface3 ring-2 ring-accent1 bg-accent1Darker';
      case 'failed':
        return 'bg-surface3 ring-2 ring-accent2 bg-accent2Darker';
      case 'pending':
        return 'bg-surface3 border border-border1';
      default:
        return 'bg-surface3 border border-border1';
    }
  };

  // Always format the step ID as the title
  const formatStepTitle = (stepId: string) => {
    return stepId.charAt(0).toUpperCase() + stepId.slice(1).replace(/-/g, ' ');
  };

  return (
    <div ref={stepRef} className={`rounded-lg p-4 transition-all duration-200 ${getStatusColor(stepData.status)}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          {/* Always show formatted step name as title */}
          <div className="font-medium text-icon6 text-base">{formatStepTitle(stepId)}</div>
          {/* Show description separately if available */}
          {stepData.description && <div className="text-icon3 text-sm mt-1">{stepData.description}</div>}
        </div>
        <div className="flex-shrink-0 ml-4">{getStatusIcon(stepData.status)}</div>
      </div>
    </div>
  );
}

export function TemplateInstallation({ name, streamResult, runId, workflowInfo }: TemplateInstallationProps) {
  const phase = streamResult?.phase || 'initializing';
  const workflowState = streamResult?.payload?.workflowState;
  const currentStep = streamResult?.payload?.currentStep;
  const error = streamResult?.error;

  // Refs for auto-scrolling to current step
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({});

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

  // Create refs for each visible step
  visibleSteps.forEach(([stepId]) => {
    if (!stepRefs.current[stepId]) {
      stepRefs.current[stepId] = createRef<HTMLDivElement>();
    }
  });

  // Auto-scroll to current step
  useEffect(() => {
    if (currentStep?.id && stepRefs.current[currentStep.id]?.current && scrollContainerRef.current) {
      const stepElement = stepRefs.current[currentStep.id].current;
      const containerElement = scrollContainerRef.current;

      if (stepElement) {
        // Calculate the position to scroll to (center the step in the container)
        const stepTop = stepElement.offsetTop;
        const stepHeight = stepElement.offsetHeight;
        const containerHeight = containerElement.offsetHeight;
        const scrollTop = stepTop - containerHeight / 2 + stepHeight / 2;

        containerElement.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth',
        });
      }
    }
  }, [currentStep?.id]);

  // Calculate progress based on visible step statuses
  const completedSteps = visibleSteps.filter(
    ([_, stepData]: [string, any]) => stepData.status === 'success' || stepData.status === 'failed',
  ).length;
  const totalSteps = visibleSteps.length;
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Determine if workflow is complete
  const isComplete = phase === 'completed';
  const progressBarColor = isComplete ? 'bg-accent1' : 'bg-accent6';

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

  const getPhaseIcon = () => {
    switch (phase) {
      case 'processing':
        return <Spinner className="w-6 h-6" />;
      case 'completed':
        return <span className="text-2xl">🎉</span>;
      case 'error':
        return <span className="text-2xl">❌</span>;
      case 'initializing':
      default:
        return <Spinner className="w-6 h-6" />;
    }
  };

  return (
    <Container className="space-y-6 text-icon3">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center">{getPhaseIcon()}</div>
        <h3 className="text-lg font-semibold text-icon5">{getPhaseMessage()}</h3>
        {runId && <div className="text-xs text-gray-500">Run ID: {runId}</div>}
      </div>

      {/* Progress Bar */}
      {hasSteps && totalSteps > 0 && (
        <div className="space-y-2">
          <div className="w-full bg-surface3 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ease-out ${progressBarColor}`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-xs text-icon3 text-center">
            {completedSteps} of {totalSteps} steps completed ({progressPercentage}%)
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && phase === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-lg">❌</span>
            <div>
              <div className="font-medium text-red-800">Installation Failed</div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Steps Display */}
      {hasSteps && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-icon4">Installation Progress</h4>
          <div ref={scrollContainerRef} className="space-y-4 max-h-80 overflow-y-auto p-1">
            {visibleSteps.map(([stepId, stepData]: [string, any]) => (
              <TemplateStepStatus
                key={stepId}
                stepId={stepId}
                stepData={stepData}
                isActive={currentStep?.id === stepId}
                stepRef={stepRefs.current[stepId]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Simple loading state for initialization */}
      {phase === 'initializing' && !hasSteps && (
        <div className="text-center text-sm text-icon3">This may take some time...</div>
      )}
    </Container>
  );
}
