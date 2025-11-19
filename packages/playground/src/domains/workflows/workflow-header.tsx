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
  DividerIcon,
  WorkflowCombobox,
  Badge,
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
          <Crumb as={Link} to={`/workflows`} isCurrent>
            <Icon>
              <WorkflowIcon />
            </Icon>
            Workflows
          </Crumb>
        </Breadcrumb>

        <HeaderGroup>
          <div className="w-[240px]">
            <WorkflowCombobox value={workflowId} />
          </div>

          {runId && (
            <>
              <DividerIcon />
              <Badge variant="default">Run: {runId}</Badge>
            </>
          )}

          <DividerIcon />

          <Button as={Link} to={`/workflows/${workflowId}/graph`}>
            Graph
          </Button>

          <DividerIcon />

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
