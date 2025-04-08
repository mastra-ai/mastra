import { useParams } from 'react-router';

import { WorkflowRunProvider, Header, HeaderTitle } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { useWorkflow } from '@/hooks/use-workflows';

import { WorkflowHeader } from './workflow-header';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId } = useParams();
  const { workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);
  return (
    <WorkflowRunProvider>
      <div className="h-full overflow-hidden">
        {isWorkflowLoading ? (
          <Header>
            <HeaderTitle>
              <Skeleton className="h-6 w-[200px]" />
            </HeaderTitle>
          </Header>
        ) : (
          <WorkflowHeader workflowName={workflow?.name!} workflowId={workflowId!} />
        )}
        {children}
      </div>
    </WorkflowRunProvider>
  );
};
