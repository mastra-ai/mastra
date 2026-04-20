import { Header, Breadcrumb, Crumb, Icon, AgentIcon } from '@mastra/playground-ui';
import { Link } from 'react-router';
import { AgentCombobox } from '@/domains/agents/components/agent-combobox';

export function AgentHeader({ agentId, children }: { agentId: string; children?: React.ReactNode }) {
  return (
    <Header className="border-b-0">
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

      {children && (
        <>
          <div aria-hidden className="h-5 w-px bg-border1" />
          <div className="flex min-w-0 flex-1 items-center">{children}</div>
        </>
      )}
    </Header>
  );
}
