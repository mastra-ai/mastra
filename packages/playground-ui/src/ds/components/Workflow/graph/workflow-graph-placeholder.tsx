import { Skeleton } from '@/ds/components/Skeleton';
import { IconExclamationCircle } from '@/ds/icons/central/IconExclamationCircle';

export type WorkflowGraphPlaceholderProps = { isLoading: true } | { isLoading?: false; workflowName: string };

export function WorkflowGraphPlaceholder(props: WorkflowGraphPlaceholderProps) {
  if (props.isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-full" />
      </div>
    );
  }

  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-2">
        <IconExclamationCircle />
        <div>We couldn&apos;t find {props.workflowName} workflow.</div>
      </div>
    </div>
  );
}
