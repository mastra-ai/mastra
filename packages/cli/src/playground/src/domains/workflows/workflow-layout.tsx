import { useParams } from 'react-router';

import { Header } from '@/components/ui/header';
import { Skeleton } from '@/components/ui/skeleton';

import { useWorkflow } from '@/hooks/use-workflows';

import { WorkflowHeader } from './workflow-header';
import { WorkflowRunProvider } from './workflow-run-context';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId } = useParams();
  const { workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);
  return (
    <WorkflowRunProvider>
      <div className="flex flex-col h-full overflow-hidden">
        {isWorkflowLoading ? (
          <Header title={<Skeleton className="h-6 w-[200px]" />} />
        ) : (
          <WorkflowHeader workflowName={workflow?.name!} workflowId={workflowId!} />
        )}
        {children}
      </div>
    </WorkflowRunProvider>
  );
};
