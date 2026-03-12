import { Header, Breadcrumb, Crumb, Button, HeaderAction, Icon, DocsIcon, AgentIcon } from '@mastra/playground-ui';
import { AgentCombobox } from '@mastra/playground-ui/agents';
import { useIsCmsAvailable } from '@mastra/playground-ui/cms';
import { EyeIcon } from 'lucide-react';
import { Link } from 'react-router';

export function AgentHeader({ agentId }: { agentId: string }) {
  const { isCmsAvailable } = useIsCmsAvailable();

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
          <AgentCombobox value={agentId} variant="ghost" showSourceIcon={isCmsAvailable} />
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
