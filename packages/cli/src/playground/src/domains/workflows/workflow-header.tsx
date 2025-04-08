import { NavLink } from 'react-router';

import { Crumb, Header, HeaderGroup, Button, Breadcrumb } from '@mastra/playground-ui';

export function WorkflowHeader({ workflowName, workflowId }: { workflowName: string; workflowId: string }) {
  return (
    <Header>
      <Breadcrumb>
        <Crumb as={NavLink} href={`/workflows`}>
          Workflows
        </Crumb>
        <Crumb as={NavLink} href={`/workflows/${workflowId}`} isCurrent>
          {workflowName}
        </Crumb>
      </Breadcrumb>
      <HeaderGroup>
        <Button as={NavLink} href={`/workflows/${workflowId}/graph`}>
          Graph
        </Button>
        <Button as={NavLink} href={`/workflows/${workflowId}/traces`}>
          Traces
        </Button>
      </HeaderGroup>
    </Header>
  );
}
