import { Notice } from '@mastra/playground-ui/components/Notice';
import { getWorkflowRunErrors } from './workflow-run-errors';

export function WorkflowRunError({ result, workflowError }: { result: unknown; workflowError?: Error | null }) {
  const errors = getWorkflowRunErrors(result, workflowError);
  if (errors.length === 0) return null;

  return (
    <Notice variant="destructive" title="Workflow failed">
      <div className="flex flex-col gap-1">
        {errors.map(error => (
          <Notice.Message key={error}>{error}</Notice.Message>
        ))}
      </div>
    </Notice>
  );
}
