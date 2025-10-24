import { Link } from 'react-router';

import {
  Crumb,
  Header,
  HeaderGroup,
  Button,
  Breadcrumb,
  HeaderAction,
  Icon,
  ApiIcon,
  WorkflowIcon,
  DocsIcon,
} from '@mastra/playground-ui';

export function WorkflowHeader({
  workflowName,
  workflowId,
  runId,
}: {
  workflowName: string;
  workflowId: string;
  runId?: string;
}) {
  return (
    <div className="shrink-0">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/workflows`}>
            <Icon>
              <WorkflowIcon />
            </Icon>
            Workflows
          </Crumb>
          <Crumb as={Link} to={`/workflows/${workflowId}`} isCurrent={!runId}>
            {workflowName}
          </Crumb>

          {runId && (
            <Crumb as={Link} to={`/workflows/${workflowId}/graph/${runId}`} isCurrent>
              {runId}
            </Crumb>
          )}
        </Breadcrumb>

        <HeaderGroup>
          <Button as={Link} to={`/workflows/${workflowId}/graph`}>
            Graph
          </Button>
          <Button as={Link} to={`/observability?entity=${workflowName}`}>
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

          <Button as={Link} to="https://mastra.ai/en/docs/workflows/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Workflows documentation
          </Button>
        </HeaderAction>
      </Header>
    </div>
  );
}
