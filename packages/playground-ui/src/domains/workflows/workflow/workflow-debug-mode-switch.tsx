import { useContext } from 'react';
import { Field, FieldContent, FieldDescription, FieldLabel } from '../../../ds/components/Field';
import { Switch } from '../../../ds/components/Switch';
import { WorkflowRunContext } from '../context/workflow-run-context';

export function WorkflowDebugModeSwitch() {
  const { debugMode, setDebugMode } = useContext(WorkflowRunContext);

  return (
    <Field orientation="horizontal" className="min-w-0">
      <Switch checked={debugMode} onCheckedChange={setDebugMode} />
      <FieldContent className="gap-0.5">
        <FieldLabel size="smaller">Step by step</FieldLabel>
        <FieldDescription className="text-meta text-muted-foreground">Pause to inspect outputs</FieldDescription>
      </FieldContent>
    </Field>
  );
}
