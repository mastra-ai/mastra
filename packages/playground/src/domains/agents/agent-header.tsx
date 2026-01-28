import { Link, useSearchParams } from 'react-router';

import {
  Header,
  Breadcrumb,
  Crumb,
  HeaderGroup,
  Button,
  DividerIcon,
  HeaderAction,
  Icon,
  DocsIcon,
  AgentIcon,
  AgentCombobox,
} from '@mastra/playground-ui';

export function AgentHeader({
  agentId,
  threadId,
}: {
  agentName: string;
  agentId: string;
  threadId?: string;
}) {
  const [searchParams] = useSearchParams();
  const isNewThread = searchParams.get('new') === 'true';

  return (
    <Header>
      <Breadcrumb>
        <Crumb as={Link} to={`/agents`}>
          <Icon>
            <AgentIcon />
          </Icon>
          Agents
        </Crumb>
        <Crumb as="span" to="" isCurrent>
          <AgentCombobox value={agentId} variant="ghost" />
        </Crumb>
      </Breadcrumb>

      <HeaderGroup>
        <Button as={Link} to={`/agents/${agentId}/chat`}>
          Chat
        </Button>

        <DividerIcon />

        <div className="flex items-center gap-1">
          <div className="text-ui-md flex items-center text-neutral2 pr-1 pl-3">Traces by </div>
          <Button as={Link} to={`/observability?entity=${agentId}`}>
            Agent
          </Button>

          {threadId && !isNewThread && (
            <Button as={Link} to={`/observability?threadId=${threadId}`}>
              Thread
            </Button>
          )}
        </div>
      </HeaderGroup>

      <HeaderAction>
        <Button as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank">
          <Icon>
            <DocsIcon />
          </Icon>
          Agents documentation
        </Button>
      </HeaderAction>
    </Header>
  );
}
