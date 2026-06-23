import type { WorkflowRunStatus } from '@mastra/core/workflows';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogBody,
} from '@mastra/playground-ui';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import {
  AlertCircleIcon,
  BracesIcon,
  Clock3Icon,
  LayersIcon,
  MoreVerticalIcon,
  PlayIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  StepForwardIcon,
} from 'lucide-react';
import { useContext, useMemo, useState } from 'react';
import type { TripwireData } from '../context/use-current-run';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import { CodeDialogContent } from './workflow-code-dialog-content';
import { WorkflowTimeTravelForm } from './workflow-time-travel-form';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';

export interface WorkflowStepActionBarProps {
  input?: any;
  resumeData?: any;
  output?: any;
  suspendOutput?: any;
  error?: any;
  tripwire?: TripwireData;
  stepName: string;
  stepId?: string;
  mapConfig?: string;
  onShowNestedGraph?: () => void;
  status?: WorkflowRunStatus;
  stepKey?: string;
  stepsFlow?: Record<string, string[]>;
}

export const WorkflowStepActionBar = ({
  input: _input,
  resumeData,
  output: _output,
  suspendOutput: _suspendOutput,
  error,
  tripwire,
  mapConfig,
  stepName,
  stepId,
  onShowNestedGraph,
  stepKey,
  stepsFlow,
}: WorkflowStepActionBarProps) => {
  const [isResumeDataOpen, setIsResumeDataOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [isTripwireOpen, setIsTripwireOpen] = useState(false);
  const [isTimeTravelOpen, setIsTimeTravelOpen] = useState(false);
  const [isContinueRunOpen, setIsContinueRunOpen] = useState(false);
  const [isPerStepRunOpen, setIsPerStepRunOpen] = useState(false);

  const {
    withoutTimeTravel,
    debugMode,
    result,
    runSnapshot,
    timeTravelWorkflowStream,
    runId: prevRunId,
    workflowId,
    setDebugMode,
  } = useContext(WorkflowRunContext);
  const { showMapConfig, stepDetail, closeStepDetail } = useWorkflowStepDetail();
  const requestContext = useMergedRequestContext();

  const workflowStatus = result?.status ?? runSnapshot?.status;

  const dialogContentClass = 'max-w-4xl w-full';

  const showTimeTravel =
    !withoutTimeTravel && stepKey && !mapConfig && workflowStatus !== 'running' && workflowStatus !== 'paused';

  const inDebugMode = stepKey && debugMode && workflowStatus === 'paused';

  const stepPayload = useMemo(() => {
    if (!stepKey || !inDebugMode) return undefined;
    const previousSteps = stepsFlow?.[stepKey] ?? [];
    if (previousSteps.length === 0) return undefined;

    if (previousSteps.length > 1) {
      return {
        hasMultiSteps: true,
        input: previousSteps.reduce(
          (acc, stepId) => {
            if (result?.steps?.[stepId]?.status === 'success') {
              acc[stepId] = result?.steps?.[stepId].output;
            }
            return acc;
          },
          {} as Record<string, any>,
        ),
      };
    }

    const prevStepId = previousSteps[0];
    if (result?.steps?.[prevStepId]?.status === 'success') {
      return {
        hasMultiSteps: false,
        input: result?.steps?.[prevStepId].output,
      };
    }

    return undefined;
  }, [stepKey, stepsFlow, inDebugMode, result]);

  const showDebugMode = inDebugMode && stepPayload && !result?.steps?.[stepKey];

  // Check if this step's detail is currently open
  const isMapConfigOpen = stepDetail?.type === 'map-config' && stepDetail?.stepName === stepName;
  const isNestedGraphOpen = stepDetail?.type === 'nested-graph' && stepDetail?.stepName === stepName;

  const handleMapConfigClick = () => {
    if (isMapConfigOpen) {
      closeStepDetail();
    } else {
      showMapConfig({ stepName, stepId, mapConfig: mapConfig! });
    }
  };

  const handleNestedGraphClick = () => {
    if (isNestedGraphOpen) {
      closeStepDetail();
    } else {
      onShowNestedGraph?.();
    }
  };

  const handleRunMapStep = (isContinueRun?: boolean) => {
    const payload = {
      runId: prevRunId,
      workflowId,
      step: stepKey as string,
      inputData: stepPayload?.hasMultiSteps ? undefined : stepPayload?.input,
      requestContext: requestContext,
      ...(isContinueRun ? { perStep: false } : {}),
      ...(stepPayload?.hasMultiSteps
        ? {
            context: Object.keys(stepPayload.input)?.reduce(
              (acc, stepId) => {
                acc[stepId] = {
                  output: stepPayload.input[stepId],
                };
                return acc;
              },
              {} as Record<string, any>,
            ),
          }
        : {}),
    };

    if (isContinueRun) {
      setDebugMode(false);
    }

    void timeTravelWorkflowStream(payload);
  };

  const hasActions = Boolean(
    error || tripwire || mapConfig || resumeData || onShowNestedGraph || showTimeTravel || showDebugMode,
  );

  if (!hasActions) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Step actions"
            title="Step actions"
            className="nodrag nopan"
          >
            <MoreVerticalIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {onShowNestedGraph && (
            <DropdownMenu.Item onSelect={handleNestedGraphClick}>
              <LayersIcon />
              <span>{isNestedGraphOpen ? 'Hide nested graph' : 'View nested graph'}</span>
            </DropdownMenu.Item>
          )}
          {showTimeTravel && (
            <DropdownMenu.Item onSelect={() => setIsTimeTravelOpen(true)}>
              <Clock3Icon />
              <span>Time travel</span>
            </DropdownMenu.Item>
          )}
          {showDebugMode && (
            <>
              <DropdownMenu.Item
                onSelect={() => {
                  if (mapConfig) {
                    handleRunMapStep();
                  } else {
                    setIsPerStepRunOpen(true);
                  }
                }}
              >
                <PlayIcon />
                <span>Run step</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  if (mapConfig) {
                    handleRunMapStep(true);
                  } else {
                    setIsContinueRunOpen(true);
                  }
                }}
              >
                <StepForwardIcon />
                <span>Continue run</span>
              </DropdownMenu.Item>
            </>
          )}
          {mapConfig && (
            <DropdownMenu.Item onSelect={handleMapConfigClick}>
              <BracesIcon />
              <span>{isMapConfigOpen ? 'Hide map config' : 'Map config'}</span>
            </DropdownMenu.Item>
          )}
          {resumeData && (
            <DropdownMenu.Item onSelect={() => setIsResumeDataOpen(true)}>
              <RotateCcwIcon />
              <span>Resume data</span>
            </DropdownMenu.Item>
          )}
          {error && (
            <DropdownMenu.Item onSelect={() => setIsErrorOpen(true)}>
              <AlertCircleIcon />
              <span>Error</span>
            </DropdownMenu.Item>
          )}
          {tripwire && (
            <DropdownMenu.Item onSelect={() => setIsTripwireOpen(true)} className="text-amber-400">
              <ShieldAlertIcon />
              <span>Tripwire</span>
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>

      {showTimeTravel && (
        <Dialog open={isTimeTravelOpen} onOpenChange={setIsTimeTravelOpen}>
          <DialogContent className={dialogContentClass}>
            <DialogHeader>
              <DialogTitle>Time travel to {stepKey}</DialogTitle>
              <DialogDescription>Time travel to a specific workflow step</DialogDescription>
            </DialogHeader>
            <DialogBody className="max-h-[600px]">
              <WorkflowTimeTravelForm stepKey={stepKey} closeModal={() => setIsTimeTravelOpen(false)} />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      {showDebugMode && !mapConfig && (
        <>
          <Dialog open={isPerStepRunOpen} onOpenChange={setIsPerStepRunOpen}>
            <DialogContent className={dialogContentClass}>
              <DialogHeader>
                <DialogTitle>Run step {stepKey}</DialogTitle>
                <DialogDescription>Run a specific workflow step</DialogDescription>
              </DialogHeader>
              <DialogBody className="max-h-[600px]">
                <WorkflowTimeTravelForm
                  stepKey={stepKey}
                  closeModal={() => setIsPerStepRunOpen(false)}
                  isPerStepRun
                  buttonText="Run step"
                  inputData={stepPayload?.input}
                />
              </DialogBody>
            </DialogContent>
          </Dialog>

          <Dialog open={isContinueRunOpen} onOpenChange={setIsContinueRunOpen}>
            <DialogContent className={dialogContentClass}>
              <DialogHeader>
                <DialogTitle>Continue run {stepKey}</DialogTitle>
                <DialogDescription>Continue the workflow run from this step</DialogDescription>
              </DialogHeader>
              <DialogBody className="max-h-[600px]">
                <WorkflowTimeTravelForm
                  stepKey={stepKey}
                  closeModal={() => setIsContinueRunOpen(false)}
                  isContinueRun
                  buttonText="Continue run"
                  inputData={stepPayload?.input}
                />
              </DialogBody>
            </DialogContent>
          </Dialog>
        </>
      )}

      {resumeData && (
        <Dialog open={isResumeDataOpen} onOpenChange={setIsResumeDataOpen}>
          <DialogContent className={dialogContentClass}>
            <DialogHeader>
              <DialogTitle>{stepName} resume data</DialogTitle>
              <DialogDescription>View the resume data for this step</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <CodeDialogContent data={resumeData} />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      {error && (
        <Dialog open={isErrorOpen} onOpenChange={setIsErrorOpen}>
          <DialogContent className={dialogContentClass}>
            <DialogHeader>
              <DialogTitle>{stepName} error</DialogTitle>
              <DialogDescription>View the error details for this step</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <CodeDialogContent data={error} />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      {tripwire && (
        <Dialog open={isTripwireOpen} onOpenChange={setIsTripwireOpen}>
          <DialogContent className={dialogContentClass}>
            <DialogHeader>
              <DialogTitle>{stepName} tripwire</DialogTitle>
              <DialogDescription>View the tripwire details for this step</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <CodeDialogContent
                data={{
                  reason: tripwire.reason,
                  retry: tripwire.retry,
                  metadata: tripwire.metadata,
                  processorId: tripwire.processorId,
                }}
              />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
