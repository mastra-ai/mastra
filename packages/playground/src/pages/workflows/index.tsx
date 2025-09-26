import { useWorkflows } from '@/hooks/use-workflows';
import { Header, HeaderTitle, MainContentLayout, MainContentContent, WorkflowTable } from '@mastra/playground-ui';

function Workflows() {
  const { data: workflows, isLoading } = useWorkflows();

  const isEmpty = !isLoading && Object.keys(workflows || {}).length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Workflows</HeaderTitle>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <WorkflowTable workflows={workflows} isLoading={isLoading} />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Workflows;
