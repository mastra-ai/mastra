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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
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
          <div className="w-48">
            <WorkflowCombobox value={workflowId} />
          </div>

          {runId && (
            <>
              <DividerIcon />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="default">#{runId.slice(0, 8)}</Badge>
                </TooltipTrigger>
                <TooltipContent>{`Workflow Run ID: ${runId}`}</TooltipContent>
              </Tooltip>

              <DividerIcon />
            </>
          )}

          <div className="flex items-center gap-1">
            <div className="text-ui-md flex items-center text-neutral2 pr-1 pl-3">Traces by </div>
            <Button as={Link} to={`/observability?entity=${workflowName}`}>
              Workflow
            </Button>

            {runId && (
              <Button as={Link} to={`/observability?runId=${runId}`}>
                Run
              </Button>
            )}
          </div>
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
