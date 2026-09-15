import { Switch } from '@mastra/playground-ui/components/Switch';
import { useContext, useId } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';

export function WorkflowDebugModeSwitch() {
  const { debugMode, setDebugMode } = useContext(WorkflowRunContext);
  const descriptionId = useId();

  return (
    <label className="flex min-w-0 cursor-pointer items-center gap-2">
      <Switch
        checked={debugMode}
        onCheckedChange={setDebugMode}
        aria-label="Step by step"
        aria-describedby={descriptionId}
      />
      <span className="text-ui-xs flex min-w-0 flex-col gap-0.5">
        <span className="text-neutral5">Step by step</span>
        <span id={descriptionId} className="text-neutral3">
          Pause to inspect outputs
        </span>
      </span>
    </label>
  );
}
