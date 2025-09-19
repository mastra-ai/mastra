import { useParams } from 'react-router';

import { WorkflowRunProvider, Header, HeaderTitle } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { useLegacyWorkflow } from '@/hooks/use-workflows';

import { WorkflowHeader } from './workflow-header';

export const LegacyWorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId } = useParams();
  const { data: legacyWorkflow, isLoading: isWorkflowLoading } = useLegacyWorkflow(workflowId!);

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
          <WorkflowHeader workflowName={legacyWorkflow?.name || ''} workflowId={workflowId!} isLegacy />
        )}
        {children}
      </div>
    </WorkflowRunProvider>
  );
};
