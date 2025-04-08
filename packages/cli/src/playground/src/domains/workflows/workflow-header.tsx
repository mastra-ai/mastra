import { Link } from 'react-router';

import { Crumb, Header, HeaderGroup, Button, Breadcrumb } from '@mastra/playground-ui';

export function WorkflowHeader({ workflowName, workflowId }: { workflowName: string; workflowId: string }) {
  return (
    <Header>
      <Breadcrumb>
        <Crumb as={Link} to={`/workflows`}>
          Workflows
        </Crumb>
        <Crumb as={Link} to={`/workflows/${workflowId}`} isCurrent>
          {workflowName}
        </Crumb>
      </Breadcrumb>

      <HeaderGroup>
        <Button as={Link} to={`/workflows/${workflowId}/graph`}>
          Graph
        </Button>
        <Button as={Link} to={`/workflows/${workflowId}/traces`}>
          Traces
        </Button>
      </HeaderGroup>
    </Header>
  );
}
