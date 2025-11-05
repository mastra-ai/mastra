import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';

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
  Combobox,
  useWorkflows,
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
  const navigate = useNavigate();
  const { data: workflows = {} } = useWorkflows();

  const workflowOptions = useMemo(() => {
    return Object.keys(workflows).map(key => ({
      label: workflows[key]?.name || key,
      value: key,
    }));
  }, [workflows]);

  const handleWorkflowChange = (newWorkflowId: string) => {
    if (newWorkflowId && newWorkflowId !== workflowId) {
      navigate(`/workflows/${newWorkflowId}`);
    }
  };

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
            <Combobox
              options={workflowOptions}
              value={workflowId}
              onValueChange={handleWorkflowChange}
              placeholder="Select a workflow..."
              searchPlaceholder="Search workflows..."
              emptyText="No workflows found."
              buttonClassName="h-8"
            />
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
