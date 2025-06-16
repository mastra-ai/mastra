import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { MainContentContent } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { MastraResizablePanel } from '@mastra/playground-ui';

export interface WorkflowGraphLayoutProps {
  children: React.ReactNode;
}

export const WorkflowGraphLayout = ({ children }: WorkflowGraphLayoutProps) => {
  const { workflowId } = useParams();

  return (
    <MainContentContent isDivided={true} className="flex">
      {children}
      <MastraResizablePanel
        defaultWidth={20}
        minimumWidth={20}
        maximumWidth={60}
        className="flex flex-col min-w-[325px] right-0 top-0 h-full z-20 bg-[#121212] [&>div:first-child]:-left-[1px] [&>div:first-child]:-right-[1px] [&>div:first-child]:w-[1px] [&>div:first-child]:bg-[#424242] [&>div:first-child]:hover:w-[2px] [&>div:first-child]:active:w-[2px]"
      >
        <WorkflowInformation workflowId={workflowId!} />
      </MastraResizablePanel>
    </MainContentContent>
  );
};
