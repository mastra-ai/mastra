import type { WorkflowRunStatus } from '@mastra/core/workflows';
import {
  AlertCircleIcon,
  BracesIcon,
  LayersIcon,
  MoreVerticalIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../../ds/components/Button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogBody,
} from '../../../../ds/components/Dialog';
import { DropdownMenu } from '../../../../ds/components/DropdownMenu';
import type { TripwireData } from '../context/use-current-run';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import { CodeDialogContent } from './workflow-code-dialog-content';

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
  const { showMapConfig, stepDetail, closeStepDetail } = useWorkflowStepDetail();
  const dialogContentClass = 'max-w-4xl w-full';

  // Check if this step's detail is currently open
  const isMapConfigOpen = stepDetail?.type === 'map-config' && stepDetail?.stepName === stepName;
  const isNestedGraphOpen = stepDetail?.type === 'nested-graph' && stepDetail?.stepName === stepName;

  const handleMapConfigClick = () => {
    if (isMapConfigOpen) {
      closeStepDetail();
    } else if (mapConfig !== undefined) {
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

  const hasActions = Boolean(error || tripwire || mapConfig || resumeData || onShowNestedGraph);

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
