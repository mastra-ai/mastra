import { Link } from 'react-router';
import { Pencil } from 'lucide-react';

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
  isStoredWorkflow = false,
}: {
  workflowName: string;
  workflowId: string;
  runId?: string;
  isStoredWorkflow?: boolean;
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
          <div className="w-48">
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

          {isStoredWorkflow && (
            <>
              <DividerIcon />
              <Button as={Link} to={`/workflows/${workflowId}/edit`}>
                <Icon>
                  <Pencil className="h-4 w-4" />
                </Icon>
                Edit
              </Button>
            </>
          )}

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
