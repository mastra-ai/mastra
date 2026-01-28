import { Link } from 'react-router';

import {
  Header,
  Breadcrumb,
  Crumb,
  HeaderGroup,
  Button,
  HeaderAction,
  Icon,
  DocsIcon,
  AgentIcon,
  AgentCombobox,
} from '@mastra/playground-ui';
import { EyeIcon } from 'lucide-react';

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

      <HeaderGroup>
        <Button as={Link} to={`/observability?entity=${agentId}`}>
          <Icon>
            <EyeIcon />
          </Icon>
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
