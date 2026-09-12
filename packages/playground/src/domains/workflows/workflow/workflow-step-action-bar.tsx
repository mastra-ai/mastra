import type { TimeTravelParams } from '@mastra/client-js';
import type { WorkflowRunStatus } from '@mastra/core/workflows';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogBody,
} from '@mastra/playground-ui/components/Dialog';
import {
  WorkflowCodeContent,
  WorkflowStepActions,
  WorkflowStepAction,
} from '@mastra/playground-ui/components/Workflow';

import { useContext, useMemo, useState } from 'react';
import type { TripwireData } from '../context/use-current-run';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
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
        input: previousSteps.reduce<Record<string, unknown>>((acc, stepId) => {
          if (result?.steps?.[stepId]?.status === 'success') {
            acc[stepId] = result?.steps?.[stepId].output;
          }
          return acc;
        }, {}),
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
    if (!stepKey || !stepPayload) return;

    const payload = {
      runId: prevRunId,
      workflowId,
      step: stepKey,
      inputData: stepPayload?.hasMultiSteps ? undefined : stepPayload?.input,
      requestContext: requestContext,
      ...(isContinueRun ? { perStep: false } : {}),
      ...(stepPayload?.hasMultiSteps
        ? {
            context: Object.keys(stepPayload.input)?.reduce<NonNullable<TimeTravelParams['context']>>((acc, stepId) => {
              acc[stepId] = {
                status: 'success',
                output: stepPayload.input[stepId],
              };
              return acc;
            }, {}),
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
      <WorkflowStepActions>
        {onShowNestedGraph && (
          <WorkflowStepAction action="nested" isActive={isNestedGraphOpen} onSelect={handleNestedGraphClick} />
        )}
        {showTimeTravel && <WorkflowStepAction action="timeTravel" onSelect={() => setIsTimeTravelOpen(true)} />}
        {showDebugMode && (
          <>
            <WorkflowStepAction
              action="runStep"
              onSelect={() => {
                if (mapConfig) handleRunMapStep();
                else setIsPerStepRunOpen(true);
              }}
            />
            <WorkflowStepAction
              action="continueRun"
              onSelect={() => {
                if (mapConfig) handleRunMapStep(true);
                else setIsContinueRunOpen(true);
              }}
            />
          </>
        )}
        {mapConfig && <WorkflowStepAction action="map" isActive={isMapConfigOpen} onSelect={handleMapConfigClick} />}
        {resumeData && <WorkflowStepAction action="resumeData" onSelect={() => setIsResumeDataOpen(true)} />}
        {error && <WorkflowStepAction action="error" onSelect={() => setIsErrorOpen(true)} />}
        {tripwire && <WorkflowStepAction action="tripwire" onSelect={() => setIsTripwireOpen(true)} />}
      </WorkflowStepActions>

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
              <WorkflowCodeContent data={resumeData} />
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
              <WorkflowCodeContent data={error} />
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
              <WorkflowCodeContent
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
