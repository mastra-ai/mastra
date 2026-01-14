import { Txt } from '@/ds/components/Txt';
import { useContext } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { Checkbox } from '@/ds/components/Checkbox';

export const WorkflowRunOptions = () => {
  const { debugMode, setDebugMode } = useContext(WorkflowRunContext);
  return (
    <>
      <Txt as="h3" variant="ui-md" className="text-neutral3">
        Debug Mode
      </Txt>

      <Checkbox checked={debugMode} onCheckedChange={value => setDebugMode(value as boolean)} />
    </>
  );
};
