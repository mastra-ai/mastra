import { useContext } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/ds/components/Field';
import { Switch } from '@/ds/components/Switch';

export function WorkflowDebugModeSwitch() {
  const { debugMode, setDebugMode } = useContext(WorkflowRunContext);

  return (
    <Field orientation="horizontal" className="min-w-0 gap-2">
      <Switch checked={debugMode} onCheckedChange={setDebugMode} />
      <FieldContent className="gap-0.5">
        <FieldLabel className="cursor-pointer text-meta text-foreground">Step by step</FieldLabel>
        <FieldDescription className="text-meta text-muted-foreground">Pause to inspect outputs</FieldDescription>
      </FieldContent>
    </Field>
  );
}
