import { useParams, useSearchParams } from 'react-router';

import { WorkflowRunProvider, Header, HeaderTitle } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { useVNextWorkflow, useWorkflow } from '@/hooks/use-workflows';

import { WorkflowHeader } from './workflow-header';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId } = useParams();
  const [searchParams] = useSearchParams();
  const isVNext = searchParams.get('version') === 'v-next';
  const { workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!, !isVNext);
  const { vNextWorkflow, isLoading: isVNextWorkflowLoading } = useVNextWorkflow(workflowId!, isVNext);

  return (
    <WorkflowRunProvider>
      <div className="h-full overflow-hidden">
        {isWorkflowLoading || isVNextWorkflowLoading ? (
          <Header>
            <HeaderTitle>
              <Skeleton className="h-6 w-[200px]" />
            </HeaderTitle>
          </Header>
        ) : (
          <WorkflowHeader workflowName={workflow?.name || vNextWorkflow?.name || ''} workflowId={workflowId!} />
        )}
        {children}
      </div>
    </WorkflowRunProvider>
  );
};
