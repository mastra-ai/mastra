import { useWorkflows } from '@/hooks/use-workflows';
import { Header, HeaderTitle, MainContentLayout, MainContentContent, WorkflowTable } from '@mastra/playground-ui';
import { useNavigate } from 'react-router';

function Workflows() {
  const { data, isLoading } = useWorkflows();
  const navigate = useNavigate();
  const [legacyWorkflows, workflows] = data ?? [];

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Workflows</HeaderTitle>
      </Header>

      <MainContentContent isCentered={!isLoading && Object.keys(data || {}).length === 0}>
        <WorkflowTable
          workflows={workflows}
          legacyWorkflows={legacyWorkflows}
          isLoading={isLoading}
          onClickRow={workflowId => navigate(`/workflows/${workflowId}/graph`)}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Workflows;
