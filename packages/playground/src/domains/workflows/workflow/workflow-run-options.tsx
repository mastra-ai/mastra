import { Checkbox, Txt } from '@mastra/playground-ui';
import { useContext } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';

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
