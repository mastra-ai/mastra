import { useWorkflows } from '@/hooks/use-workflows';
import { Header, HeaderTitle, MainContentLayout, MainContentContent, WorkflowTable } from '@mastra/playground-ui';

function Workflows() {
  const { data, isLoading } = useWorkflows();
  const [legacyWorkflows, workflows] = data ?? [];

  const isEmpty =
    !isLoading && Object.keys(legacyWorkflows || {}).length === 0 && Object.keys(workflows || {}).length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Workflows</HeaderTitle>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <WorkflowTable
          workflows={workflows}
          legacyWorkflows={legacyWorkflows}
          isLoading={isLoading}
          computeLink={workflowId => `/workflows/${workflowId}/graph`}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Workflows;
