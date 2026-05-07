import { Header, Breadcrumb, Crumb, Button, HeaderAction, Icon, DocsIcon, AgentIcon } from '@mastra/playground-ui';
import { Link } from 'react-router';
import { AgentCombobox } from '@/domains/agents/components/agent-combobox';

export function AgentHeader({ agentId }: { agentId: string }) {
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

      <HeaderAction>
        <Button as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank" variant="ghost" size="md">
          <DocsIcon />
          Docs
        </Button>
      </HeaderAction>
    </Header>
  );
}
