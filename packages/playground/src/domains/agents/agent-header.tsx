import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';

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
  Combobox,
  useAgents,
} from '@mastra/playground-ui';

export function AgentHeader({ agentName, agentId }: { agentName: string; agentId: string }) {
  const navigate = useNavigate();
  const { data: agents = {} } = useAgents();

  const agentOptions = useMemo(() => {
    return Object.keys(agents).map(key => ({
      label: agents[key]?.name || key,
      value: key,
    }));
  }, [agents]);

  const handleAgentChange = (newAgentId: string) => {
    if (newAgentId && newAgentId !== agentId) {
      navigate(`/agents/${newAgentId}`);
    }
  };

  return (
    <Header>
      <Breadcrumb>
        <Crumb as={Link} to={`/agents`} isCurrent>
          <Icon>
            <AgentIcon />
          </Icon>
          Agents
        </Crumb>
      </Breadcrumb>

      <HeaderGroup>
        <div className="w-[240px]">
          <Combobox
            options={agentOptions}
            value={agentId}
            onValueChange={handleAgentChange}
            placeholder="Select an agent..."
            searchPlaceholder="Search agents..."
            emptyText="No agents found."
            buttonClassName="h-8"
          />
        </div>

        <DividerIcon />

        <Button as={Link} to={`/agents/${agentId}/chat`}>
          Chat
        </Button>

        <DividerIcon />

        <Button as={Link} to={`/observability?entity=${agentName}`}>
          Traces
        </Button>
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
