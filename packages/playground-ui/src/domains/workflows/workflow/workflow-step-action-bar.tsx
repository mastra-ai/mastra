import { Button } from '@/ds/components/Button';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/ds/components/Dialog';
import { CodeDialogContent } from './workflow-code-dialog-content';
import { useContext, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { WorkflowTimeTravelForm } from './workflow-time-travel-form';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import type { TripwireData } from '../context/use-current-run';
import { WorkflowRunStatus } from '@mastra/core/workflows';
import { usePlaygroundStore } from '@/store/playground-store';

export interface WorkflowStepActionBarProps {
  input?: any;
  output?: any;
  suspendOutput?: any;
  resumeData?: any;
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
  input,
  output,
  resumeData,
  suspendOutput,
  error,
  tripwire,
  mapConfig,
  stepName,
  stepId,
  onShowNestedGraph,
  status,
  stepKey,
  stepsFlow,
}: WorkflowStepActionBarProps) => {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
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
  const { requestContext } = usePlaygroundStore();

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

  const showDebugMode = inDebugMode && stepPayload && !result?.steps[stepKey];

  // Check if this step's detail is currently open
  const isMapConfigOpen = stepDetail?.type === 'map-config' && stepDetail?.stepName === stepName;
  const isNestedGraphOpen = stepDetail?.type === 'nested-graph' && stepDetail?.stepName === stepName;

  const activeButtonClass = 'ring-2 ring-accent1 ring-offset-1 ring-offset-transparent';

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

    timeTravelWorkflowStream(payload);
  };

  return (
    <>
      {(input ||
        output ||
        error ||
        tripwire ||
        mapConfig ||
        resumeData ||
        onShowNestedGraph ||
        showTimeTravel ||
        showDebugMode) && (
        <div
          className={cn(
            'flex flex-wrap items-center bg-surface4 border-t border-border1 px-2 py-1 gap-2 rounded-b-lg',
            status === 'success' && 'bg-accent1Dark',
            status === 'failed' && 'bg-accent2Dark',
            status === 'tripwire' && 'bg-amber-900/40 border-amber-500/20',
            status === 'suspended' && 'bg-accent3Dark',
            status === 'waiting' && 'bg-accent5Dark',
            status === 'running' && 'bg-accent6Dark',
          )}
        >
          {onShowNestedGraph && (
            <Button onClick={handleNestedGraphClick} className={cn(isNestedGraphOpen && activeButtonClass)} size="sm">
              View nested graph
            </Button>
          )}
          {showTimeTravel && (
            <>
              <Button onClick={() => setIsTimeTravelOpen(true)} size="sm">
                Time travel
              </Button>
              <Dialog open={isTimeTravelOpen} onOpenChange={setIsTimeTravelOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogHeader>
                    <DialogTitle>Time travel to {stepKey}</DialogTitle>
                    <DialogDescription className="sr-only">Time travel to a specific workflow step</DialogDescription>
                  </DialogHeader>
                  <div className="overflow-auto max-h-[600px]">
                    <WorkflowTimeTravelForm stepKey={stepKey} closeModal={() => setIsTimeTravelOpen(false)} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          {showDebugMode && (
            <>
              <Button
                onClick={() => {
                  if (mapConfig) {
                    handleRunMapStep();
                  } else {
                    setIsPerStepRunOpen(true);
                  }
                }}
                size="sm"
              >
                Run step
              </Button>
              <Dialog open={isPerStepRunOpen} onOpenChange={setIsPerStepRunOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogHeader>
                    <DialogTitle>Run step {stepKey}</DialogTitle>
                    <DialogDescription className="sr-only">Run a specific workflow step</DialogDescription>
                  </DialogHeader>
                  <div className="overflow-auto max-h-[600px]">
                    <WorkflowTimeTravelForm
                      stepKey={stepKey}
                      closeModal={() => setIsPerStepRunOpen(false)}
                      isPerStepRun
                      buttonText="Run step"
                      inputData={stepPayload?.input}
                    />
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                onClick={() => {
                  if (mapConfig) {
                    handleRunMapStep(true);
                  } else {
                    setIsContinueRunOpen(true);
                  }
                }}
                size="sm"
              >
                Continue run
              </Button>
              <Dialog open={isContinueRunOpen} onOpenChange={setIsContinueRunOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogHeader>
                    <DialogTitle>Continue run {stepKey}</DialogTitle>
                    <DialogDescription className="sr-only">Continue the workflow run from this step</DialogDescription>
                  </DialogHeader>
                  <div className="overflow-auto max-h-[600px]">
                    <WorkflowTimeTravelForm
                      stepKey={stepKey}
                      closeModal={() => setIsContinueRunOpen(false)}
                      isContinueRun
                      buttonText="Continue run"
                      inputData={stepPayload?.input}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          {mapConfig && (
            <Button onClick={handleMapConfigClick} className={cn(isMapConfigOpen && activeButtonClass)} size="sm">
              Map config
            </Button>
          )}
          {input && (
            <>
              <Button onClick={() => setIsInputOpen(true)} size="sm">
                Input
              </Button>

              <Dialog open={isInputOpen} onOpenChange={setIsInputOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogHeader>
                    <DialogTitle>{stepName} input</DialogTitle>
                    <DialogDescription className="sr-only">View the input data for this step</DialogDescription>
                  </DialogHeader>
                  <div className="overflow-hidden">
                    <CodeDialogContent data={input} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {resumeData && (
            <>
              <Button onClick={() => setIsResumeDataOpen(true)} size="sm">
                Resume data
              </Button>

              <Dialog open={isResumeDataOpen} onOpenChange={setIsResumeDataOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogHeader>
                    <DialogTitle>{stepName} resume data</DialogTitle>
                    <DialogDescription className="sr-only">View the resume data for this step</DialogDescription>
                  </DialogHeader>
                  <div className="overflow-hidden">
                    <CodeDialogContent data={resumeData} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {(output ?? suspendOutput) && (
            <>
              <Button onClick={() => setIsOutputOpen(true)} size="sm">
                Output
              </Button>

              <Dialog open={isOutputOpen} onOpenChange={setIsOutputOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogHeader>
                    <DialogTitle>{stepName} output</DialogTitle>
                    <DialogDescription className="sr-only">View the output data for this step</DialogDescription>
                  </DialogHeader>
                  <div className="overflow-hidden">
                    <CodeDialogContent data={output ?? suspendOutput} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {error && (
            <>
              <Button onClick={() => setIsErrorOpen(true)} size="sm">
                Error
              </Button>

              <Dialog open={isErrorOpen} onOpenChange={setIsErrorOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogHeader>
                    <DialogTitle>{stepName} error</DialogTitle>
                    <DialogDescription className="sr-only">View the error details for this step</DialogDescription>
                  </DialogHeader>
                  <div className="overflow-hidden">
                    <CodeDialogContent data={error} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {tripwire && (
            <>
              <Button onClick={() => setIsTripwireOpen(true)} className="text-amber-400 hover:text-amber-300" size="sm">
                Tripwire
              </Button>

              <Dialog open={isTripwireOpen} onOpenChange={setIsTripwireOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogHeader>
                    <DialogTitle>{stepName} tripwire</DialogTitle>
                    <DialogDescription className="sr-only">View the tripwire details for this step</DialogDescription>
                  </DialogHeader>
                  <div className="overflow-hidden">
                    <CodeDialogContent
                      data={{
                        reason: tripwire.reason,
                        retry: tripwire.retry,
                        metadata: tripwire.metadata,
                        processorId: tripwire.processorId,
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      )}
    </>
  );
};
