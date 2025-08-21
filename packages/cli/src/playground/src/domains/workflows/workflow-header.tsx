import { Link } from 'react-router';

import { Crumb, Header, HeaderGroup, Button, Breadcrumb, HeaderAction, Icon, ApiIcon } from '@mastra/playground-ui';

export function WorkflowHeader({
  workflowName,
  workflowId,
  isLegacy,
  runId,
}: {
  workflowName: string;
  workflowId: string;
  isLegacy?: boolean;
  runId?: string;
}) {
  return (
    <div className="shrink-0">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/workflows`}>
            Workflows
          </Crumb>
          <Crumb as={Link} to={`/workflows${isLegacy ? '/legacy' : ''}/${workflowId}`} isCurrent={!runId}>
            {workflowName}
          </Crumb>

          {runId && (
            <Crumb as={Link} to={`/workflows/${workflowId}/graph/${runId}`} isCurrent>
              {runId}
            </Crumb>
          )}
        </Breadcrumb>

        <HeaderGroup>
          <Button as={Link} to={`/workflows${isLegacy ? '/legacy' : ''}/${workflowId}/graph`}>
            Graph
          </Button>
          <Button as={Link} to={`/workflows${isLegacy ? '/legacy' : ''}/${workflowId}/traces`}>
            Traces
          </Button>
        </HeaderGroup>

        <HeaderAction>
          <Button as={Link} target="_blank" to="/swagger-ui">
            <Icon>
              <ApiIcon />
            </Icon>
            API endpoints
          </Button>
        </HeaderAction>
      </Header>
    </div>
  );
}
