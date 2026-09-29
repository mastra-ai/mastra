import { getWorkflowRunErrors } from './workflow-run-errors';
import { Notice } from '@/ds/components/Notice';

export function WorkflowRunError({
  result,
  workflowError,
  className,
}: {
  result: unknown;
  workflowError?: Error | null;
  className?: string;
}) {
  const errors = getWorkflowRunErrors(result, workflowError);
  if (errors.length === 0) return null;

  return (
    <Notice variant="destructive" title="Workflow failed" className={className}>
      <div className="flex flex-col gap-1">
        {errors.map(error => (
          <Notice.Message key={error}>{error}</Notice.Message>
        ))}
      </div>
    </Notice>
  );
}
