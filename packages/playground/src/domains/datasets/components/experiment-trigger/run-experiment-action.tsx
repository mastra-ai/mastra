import { DialogAction } from '@mastra/playground-ui/components/Dialog';

export interface RunExperimentActionProps {
  onRun: () => void;
  canRun: boolean;
  isRunning: boolean;
}

export function RunExperimentAction({ onRun, canRun, isRunning }: RunExperimentActionProps) {
  return (
    <DialogAction onConfirm={onRun} disabled={!canRun} loading={isRunning}>
      Run experiment
    </DialogAction>
  );
}
