import { useContext, useId } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { Switch } from '@/ds/components/Switch';

export function WorkflowDebugModeSwitch() {
  const { debugMode, setDebugMode } = useContext(WorkflowRunContext);
  const descriptionId = useId();

  return (
    <label className="flex min-w-0 cursor-pointer items-center gap-2 text-caption">
      <Switch
        checked={debugMode}
        onCheckedChange={setDebugMode}
        aria-label="Step by step"
        aria-describedby={descriptionId}
      />
      <span className="flex min-w-0 flex-col gap-0.5 text-meta">
        <span className="text-foreground">Step by step</span>
        <span id={descriptionId} className="text-muted-foreground">
          Pause to inspect outputs
        </span>
      </span>
    </label>
  );
}
