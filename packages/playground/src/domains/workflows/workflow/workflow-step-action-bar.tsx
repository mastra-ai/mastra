import type { SerializedStepFlowEntry, WorkflowRunStatus } from '@mastra/core/workflows';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogBody,
} from '@mastra/playground-ui';
import { useContext, useMemo, useState } from 'react';
import type { TripwireData } from '../context/use-current-run';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { CodeDialogContent } from './workflow-code-dialog-content';
import { WorkflowMapConfigDialog } from './workflow-map-config-dialog';
import { WorkflowNestedGraphDialog } from './workflow-nested-graph-dialog';
import { WorkflowTimeTravelForm } from './workflow-time-travel-form';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';

export interface WorkflowStepActionBarProps {
  input?: any;
  output?: any;
  suspendOutput?: any;
  resumeData?: any;
  error?: any;
  tripwire?: TripwireData;
  stepName: string;
  mapConfig?: string;
  nestedGraph?: { label: string; fullStep: string; stepGraph: SerializedStepFlowEntry[] };
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
  nestedGraph,
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
  const requestContext = useMergedRequestContext();

  const workflowStatus = result?.status ?? runSnapshot?.status;

  const dialogContentClass = 'max-w-3xl w-full';

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

  return (
    <>
      {(input ||
        output ||
        error ||
        tripwire ||
        mapConfig ||
        resumeData ||
        nestedGraph ||
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
          {nestedGraph && (
            <WorkflowNestedGraphDialog
              stepName={nestedGraph.label}
              fullStep={nestedGraph.fullStep}
              stepGraph={nestedGraph.stepGraph}
            />
          )}
          {showTimeTravel && (
            <>
              <Button type="button" onClick={() => setIsTimeTravelOpen(true)} size="sm">
                Time travel
              </Button>
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
            </>
          )}
          {showDebugMode && (
            <>
              <Button
                type="button"
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

              <Button
                type="button"
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
          {mapConfig && <WorkflowMapConfigDialog stepName={stepName} mapConfig={mapConfig} />}
          {input && (
            <>
              <Button type="button" onClick={() => setIsInputOpen(true)} size="sm">
                Input
              </Button>

              <Dialog open={isInputOpen} onOpenChange={setIsInputOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogHeader>
                    <DialogTitle>{stepName} input</DialogTitle>
                    <DialogDescription>View the input data for this step</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <CodeDialogContent data={input} />
                  </DialogBody>
                </DialogContent>
              </Dialog>
            </>
          )}

          {resumeData && (
            <>
              <Button type="button" onClick={() => setIsResumeDataOpen(true)} size="sm">
                Resume data
              </Button>

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
            </>
          )}

          {(output ?? suspendOutput) && (
            <>
              <Button type="button" onClick={() => setIsOutputOpen(true)} size="sm">
                Output
              </Button>

              <Dialog open={isOutputOpen} onOpenChange={setIsOutputOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogHeader>
                    <DialogTitle>{stepName} output</DialogTitle>
                    <DialogDescription>View the output data for this step</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <CodeDialogContent data={output ?? suspendOutput} />
                  </DialogBody>
                </DialogContent>
              </Dialog>
            </>
          )}

          {error && (
            <>
              <Button type="button" onClick={() => setIsErrorOpen(true)} size="sm">
                Error
              </Button>

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
            </>
          )}

          {tripwire && (
            <>
              <Button
                type="button"
                onClick={() => setIsTripwireOpen(true)}
                className="text-amber-400 hover:text-amber-300"
                size="sm"
              >
                Tripwire
              </Button>

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
            </>
          )}
        </div>
      )}
    </>
  );
};
