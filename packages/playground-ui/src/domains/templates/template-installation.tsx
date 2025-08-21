import { Container } from './shared';
import Spinner from '@/components/ui/spinner';

type TemplateInstallationProps = {
  name: string;
  streamResult?: any;
  runId?: string;
};

function TemplateStepStatus({ stepId, stepData, isActive }: { stepId: string; stepData: any; isActive: boolean }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Spinner className="w-4 h-4" />;
      case 'success':
        return <span className="text-green-500">✅</span>;
      case 'failed':
        return <span className="text-red-500">❌</span>;
      default:
        return <span className="text-gray-400">⏳</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  // Format step title like workflows do: just capitalize and replace dashes
  const formatStepTitle = (stepId: string) => {
    return stepId.charAt(0).toUpperCase() + stepId.slice(1).replace(/-/g, ' ');
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
        isActive ? 'ring-2 ring-blue-300 scale-[1.02]' : ''
      } ${getStatusColor(stepData.status)}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{formatStepTitle(stepId)}</div>
          {stepData.startTime && (
            <div className="text-xs opacity-60 mt-1">
              {stepData.status === 'running' ? 'Started' : 'Completed'} at{' '}
              {new Date(stepData.startTime).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">{getStatusIcon(stepData.status)}</div>
    </div>
  );
}

export function TemplateInstallation({ name, streamResult, runId }: TemplateInstallationProps) {
  const phase = streamResult?.phase || 'initializing';
  const workflowState = streamResult?.payload?.workflowState;
  const currentStep = streamResult?.payload?.currentStep;
  const error = streamResult?.error;

  // Get steps from the workflow state
  const workflowSteps = workflowState?.steps || {};
  const hasSteps = Object.keys(workflowSteps).length > 0;

  // Filter out internal workflow steps (like mapping steps with auto-generated IDs)
  const isUserVisibleStep = (stepId: string) => {
    // Filter out input steps
    if (stepId === 'input' || stepId.endsWith('.input')) return false;

    // Filter out auto-generated mapping steps (they contain random hex IDs)
    if (stepId.startsWith('Mapping_') && /[0-9a-f]{8}/.test(stepId)) return false;

    // Filter out other internal workflow steps with hex IDs
    if (/[0-9a-f]{8,}/.test(stepId)) return false;

    // Only show the main workflow steps we know about
    const knownSteps = [
      'clone-template',
      'analyze-package',
      'discover-units',
      'order-units',
      'prepare-branch',
      'package-merge',
      'install',
      'programmatic-file-copy',
      'intelligent-merge',
      'validation-and-fix',
    ];

    return knownSteps.includes(stepId);
  };

  const visibleSteps = Object.entries(workflowSteps).filter(([stepId, _]) => isUserVisibleStep(stepId));

  // Calculate progress based on visible step statuses
  const completedSteps = visibleSteps.filter(
    ([_, stepData]: [string, any]) => stepData.status === 'success' || stepData.status === 'failed',
  ).length;
  const totalSteps = visibleSteps.length;
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

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

  // Format current step title like workflows do
  const formatStepTitle = (stepId: string) => {
    return stepId.charAt(0).toUpperCase() + stepId.slice(1).replace(/-/g, ' ');
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
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 text-center">
            {completedSteps} of {totalSteps} steps completed ({progressPercentage}%)
          </div>
        </div>
      )}

      {/* Current Step Highlight */}
      {currentStep && phase === 'processing' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Spinner className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-medium text-blue-800">{formatStepTitle(currentStep.id)}</div>
              <div className="text-sm text-blue-600">Running step...</div>
            </div>
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

      {/* Dynamic Steps Display (like WorkflowTrigger) */}
      {hasSteps && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Installation Progress</h4>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {visibleSteps.map(([stepId, stepData]: [string, any]) => (
              <TemplateStepStatus
                key={stepId}
                stepId={stepId}
                stepData={stepData}
                isActive={currentStep?.id === stepId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Simple loading state for initialization */}
      {phase === 'initializing' && !hasSteps && (
        <div className="text-center text-sm text-gray-600">This may take some time...</div>
      )}
    </Container>
  );
}
