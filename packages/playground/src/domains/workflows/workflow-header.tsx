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
  WorkflowCombobox,
  Truncate,
} from '@mastra/playground-ui';
import { EyeIcon } from 'lucide-react';

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
          <Crumb as="span" to="" isCurrent={!runId}>
            <WorkflowCombobox value={workflowId} variant="ghost" />
          </Crumb>
          {runId && (
            <Crumb as={Link} to={`/workflows/${workflowId}/graph/${runId}`} isCurrent>
              <Truncate untilChar="-" copy>
                {runId}
              </Truncate>
            </Crumb>
          )}
        </Breadcrumb>

        <HeaderGroup>
          <Button as={Link} to={`/observability?entity=${workflowName}`}>
            <Icon>
              <EyeIcon />
            </Icon>
            Traces
          </Button>
        </HeaderGroup>

        <HeaderAction>
          <Button as="a" target="_blank" href="/swagger-ui">
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
