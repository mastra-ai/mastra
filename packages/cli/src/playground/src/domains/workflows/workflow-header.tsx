import { Link } from 'react-router';

import { Crumb, Header, HeaderGroup, Button, Breadcrumb } from '@mastra/playground-ui';

export function WorkflowHeader({
  workflowName,
  workflowId,
  isLegacy,
}: {
  workflowName: string;
  workflowId: string;
  isLegacy?: boolean;
}) {
  return (
    <Header>
      <Breadcrumb>
        <Crumb as={Link} to={`/workflows`}>
          Workflows
        </Crumb>
        <Crumb as={Link} to={`/workflows${isLegacy ? '/legacy' : ''}/${workflowId}`} isCurrent>
          {workflowName}
        </Crumb>
      </Breadcrumb>

      <HeaderGroup>
        <Button as="a" href={`/workflows${isLegacy ? '/legacy' : ''}/${workflowId}/graph`}>
          Graph
        </Button>
        <Button as="a" href={`/workflows${isLegacy ? '/legacy' : ''}/${workflowId}/traces`}>
          Traces
        </Button>
      </HeaderGroup>
    </Header>
  );
}
