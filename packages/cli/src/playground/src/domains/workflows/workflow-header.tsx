import { Link } from 'react-router';

import { Crumb, Header, HeaderGroup, Button, Breadcrumb } from '@mastra/playground-ui';

export function WorkflowHeader({
  workflowName,
  workflowId,
  isVNext,
}: {
  workflowName: string;
  workflowId: string;
  isVNext?: boolean;
}) {
  return (
    <Header>
      <Breadcrumb>
        <Crumb as={Link} to={`/workflows`}>
          Workflows
        </Crumb>
        <Crumb as={Link} to={`/workflows${isVNext ? '/v-next' : ''}/${workflowId}`} isCurrent>
          {workflowName}
        </Crumb>
      </Breadcrumb>

      <HeaderGroup>
        <Button as="a" href={`/workflows${isVNext ? '/v-next' : ''}/${workflowId}/graph`}>
          Graph
        </Button>
        <Button as="a" href={`/workflows${isVNext ? '/v-next' : ''}/${workflowId}/traces`}>
          Traces
        </Button>
      </HeaderGroup>
    </Header>
  );
}
