import { useParams } from 'react-router';

import { WorkflowRunProvider, Header, HeaderTitle } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { useVNextWorkflow } from '@/hooks/use-workflows';

import { WorkflowHeader } from './workflow-header';

export const VNextWorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId } = useParams();
  const { vNextWorkflow, isLoading: isVNextWorkflowLoading } = useVNextWorkflow(workflowId!);

  return (
    <WorkflowRunProvider>
      <div className="h-full overflow-hidden">
        {isVNextWorkflowLoading ? (
          <Header>
            <HeaderTitle>
              <Skeleton className="h-6 w-[200px]" />
            </HeaderTitle>
          </Header>
        ) : (
          <WorkflowHeader workflowName={vNextWorkflow?.name || ''} workflowId={workflowId!} isVNext />
        )}
        {children}
      </div>
    </WorkflowRunProvider>
  );
};
