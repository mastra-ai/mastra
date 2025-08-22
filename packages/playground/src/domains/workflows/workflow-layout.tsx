import { useLocation, useParams } from 'react-router';

import {
  WorkflowRunProvider,
  Header,
  HeaderTitle,
  MainContentLayout,
  MastraResizablePanel,
  MainContentContent,
} from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { useWorkflow } from '@/hooks/use-workflows';
import { cn } from '@/lib/utils';

import { WorkflowHeader } from './workflow-header';
import { useWorkflowRuns } from '@/pages/workflows/workflow/hooks/use-workflow-runs';
import { WorkflowInformation } from './workflow-information';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId, runId } = useParams();
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);
  const { data: runs } = useWorkflowRuns({ workflowId: workflowId! });
  const location = useLocation();
  const isGraphPage = location.pathname.includes('/graph');

  if (isWorkflowLoading) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
      </MainContentLayout>
    );
  }

  const run = runs?.runs.find(run => run.runId === runId);

  return (
    <WorkflowRunProvider snapshot={typeof run?.snapshot === 'object' ? run.snapshot : undefined}>
      <MainContentLayout>
        <WorkflowHeader workflowName={workflow?.name || ''} workflowId={workflowId!} runId={runId} />
        <MainContentContent isDivided={isGraphPage} className={isGraphPage ? 'flex overflow-y-hidden' : 'block'}>
          {children}

          <MastraResizablePanel
            defaultWidth={20}
            minimumWidth={20}
            maximumWidth={60}
            className={cn(
              'flex flex-col min-w-[325px] right-0 top-0 h-full z-20 bg-[#121212] [&>div:first-child]:-left-[1px] [&>div:first-child]:-right-[1px] [&>div:first-child]:w-[1px] [&>div:first-child]:bg-[#424242] [&>div:first-child]:hover:w-[2px] [&>div:first-child]:active:w-[2px]',
              { hidden: !isGraphPage },
            )}
          >
            <WorkflowInformation workflowId={workflowId!} />
          </MastraResizablePanel>
        </MainContentContent>
      </MainContentLayout>
    </WorkflowRunProvider>
  );
};
