import type { TimeTravelParams } from '@mastra/client-js';

import { useContext, useMemo, useState } from 'react';
import type { TripwireData } from '../context/use-current-run';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import { WorkflowTimeTravelForm } from './workflow-time-travel-form';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogBody } from '@/ds/components/Dialog';
import { WorkflowCodeContent, WorkflowStepActions, WorkflowStepAction } from '@/ds/components/Workflow';

export interface WorkflowStepActionBarProps {
  resumeData?: any;
  error?: any;
  tripwire?: TripwireData;
  stepName: string;
  stepId?: string;
  mapConfig?: string;
  onShowNestedGraph?: () => void;
  stepKey?: string;
  stepsFlow?: Record<string, string[]>;
  requestContext: Record<string, any>;
}

type StepDialog = 'timeTravel' | 'runStep' | 'continueRun' | 'resumeData' | 'error' | 'tripwire';

export const WorkflowStepActionBar = ({
  resumeData,
  error,
  tripwire,
  mapConfig,
  stepName,
  stepId,
  onShowNestedGraph,
  stepKey,
  stepsFlow,
  requestContext,
}: WorkflowStepActionBarProps) => {
  const [openDialog, setOpenDialog] = useState<StepDialog | null>(null);
  const dialogProps = (dialog: StepDialog) => ({
    open: openDialog === dialog,
    onOpenChange: (open: boolean) => setOpenDialog(open ? dialog : null),
  });
  const closeDialog = () => setOpenDialog(null);

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

  const workflowStatus = result?.status ?? runSnapshot?.status;

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
    if (prevStepId && result?.steps?.[prevStepId]?.status === 'success') {
      return {
        hasMultiSteps: false,
        input: result?.steps?.[prevStepId]?.output,
      };
    }

    return undefined;
  }, [stepKey, stepsFlow, inDebugMode, result]);

  const showDebugMode = inDebugMode && stepPayload && !result?.steps?.[stepKey];

  const isMapConfigOpen = stepDetail?.type === 'map-config' && stepDetail?.stepName === stepName;
  const isNestedGraphOpen = stepDetail?.type === 'nested-graph' && stepDetail.nestedGraph?.fullStep === stepKey;

  const handleMapConfigClick = () => {
    if (isMapConfigOpen) {
      closeStepDetail();
    } else if (mapConfig) {
      showMapConfig({ stepName, stepId, mapConfig });
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
        {showTimeTravel && <WorkflowStepAction action="timeTravel" onSelect={() => setOpenDialog('timeTravel')} />}
        {showDebugMode && (
          <>
            <WorkflowStepAction
              action="runStep"
              onSelect={() => {
                if (mapConfig) handleRunMapStep();
                else setOpenDialog('runStep');
              }}
            />
            <WorkflowStepAction
              action="continueRun"
              onSelect={() => {
                if (mapConfig) handleRunMapStep(true);
                else setOpenDialog('continueRun');
              }}
            />
          </>
        )}
        {mapConfig && <WorkflowStepAction action="map" isActive={isMapConfigOpen} onSelect={handleMapConfigClick} />}
        {resumeData && <WorkflowStepAction action="resumeData" onSelect={() => setOpenDialog('resumeData')} />}
        {error && <WorkflowStepAction action="error" onSelect={() => setOpenDialog('error')} />}
        {tripwire && <WorkflowStepAction action="tripwire" onSelect={() => setOpenDialog('tripwire')} />}
      </WorkflowStepActions>

      {showTimeTravel && (
        <Dialog {...dialogProps('timeTravel')}>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>Time travel to {stepKey}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <WorkflowTimeTravelForm stepKey={stepKey} closeModal={closeDialog} requestContext={requestContext} />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      {showDebugMode && !mapConfig && (
        <>
          <Dialog {...dialogProps('runStep')}>
            <DialogContent size="xl">
              <DialogHeader>
                <DialogTitle>Run step {stepKey}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <WorkflowTimeTravelForm
                  requestContext={requestContext}
                  stepKey={stepKey}
                  closeModal={closeDialog}
                  isPerStepRun
                  buttonText="Run step"
                  inputData={stepPayload?.input}
                />
              </DialogBody>
            </DialogContent>
          </Dialog>

          <Dialog {...dialogProps('continueRun')}>
            <DialogContent size="xl">
              <DialogHeader>
                <DialogTitle>Continue run {stepKey}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <WorkflowTimeTravelForm
                  requestContext={requestContext}
                  stepKey={stepKey}
                  closeModal={closeDialog}
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
        <Dialog {...dialogProps('resumeData')}>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>{stepName} resume data</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <WorkflowCodeContent data={resumeData} />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      {error && (
        <Dialog {...dialogProps('error')}>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>{stepName} error</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <WorkflowCodeContent data={error} />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      {tripwire && (
        <Dialog {...dialogProps('tripwire')}>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>{stepName} tripwire</DialogTitle>
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
