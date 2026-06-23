import { Button, Icon, DocsIcon, AgentIcon } from '@mastra/playground-ui';
import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Header, HeaderAction } from '@mastra/playground-ui/components/Header';
import { Link } from 'react-router';
import { AgentCombobox } from '@/domains/agents/components/agent-combobox';

export function AgentHeader({ agentId }: { agentId: string }) {
  return (
    <Header border={false}>
      <Breadcrumb>
        <Crumb as={Link} to={`/agents`}>
          <Icon>
            <AgentIcon />
          </Icon>
          Agents
        </Crumb>
        <Crumb as="span" to="" isCurrent>
          <AgentCombobox value={agentId} variant="ghost" size="sm" />
        </Crumb>
      </Breadcrumb>

      <HeaderAction>
        <Button as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank" variant="ghost" size="md">
          <DocsIcon />
          Agents documentation
        </Button>
      </HeaderAction>
    </Header>
  );
}
