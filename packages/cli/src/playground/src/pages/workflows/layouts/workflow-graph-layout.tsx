import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { MainContentContent } from '@mastra/playground-ui';
import { useParams } from 'react-router';

export interface WorkflowGraphLayoutProps {
  children: React.ReactNode;
}

export const WorkflowGraphLayout = ({ children }: WorkflowGraphLayoutProps) => {
  const { workflowId } = useParams();

  return (
    <MainContentContent isDivided={true}>
      {children}
      <WorkflowInformation workflowId={workflowId!} />
    </MainContentContent>
  );
};
