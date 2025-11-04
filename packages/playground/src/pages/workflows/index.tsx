import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  WorkflowTable,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  WorkflowIcon,
  useWorkflows,
} from '@mastra/playground-ui';

import { Link } from 'react-router';

function Workflows() {
  const { data: workflows, isLoading } = useWorkflows();

  const isEmpty = !isLoading && Object.keys(workflows || {}).length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <WorkflowIcon />
          </Icon>
          Workflows
        </HeaderTitle>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/workflows/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Workflows documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <WorkflowTable workflows={workflows || {}} isLoading={isLoading} />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Workflows;
