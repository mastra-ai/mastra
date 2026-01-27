import { EyeIcon } from 'lucide-react';
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
          <Crumb as={Link} to={`/workflows`}>
            <Icon>
              <WorkflowIcon />
            </Icon>
            Workflows
          </Crumb>
          <Crumb as="span" to="" isCurrent>
            <WorkflowCombobox value={workflowId} variant="ghost" />
          </Crumb>
        </Breadcrumb>

        <HeaderGroup>
          {runId && (
            <>
              <Badge variant="default">Run: {runId}</Badge>
              <DividerIcon />
            </>
          )}
        </HeaderGroup>

        <HeaderAction>
          <Button as={Link} to={`/observability?entity=${workflowName}`}>
            <Icon>
              <EyeIcon />
            </Icon>
            Traces
          </Button>

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
